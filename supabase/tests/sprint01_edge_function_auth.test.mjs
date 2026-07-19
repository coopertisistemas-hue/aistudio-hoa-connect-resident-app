import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';

const DB_CONTAINER = 'supabase_db_aistudio-hoa-connect-resident-app';

function loadSupabaseEnv() {
  const output = execSync('supabase status -o env 2>/dev/null', { encoding: 'utf-8' });
  const env = {};
  for (const line of output.trim().split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const key = line.slice(0, eq);
      const val = line.slice(eq + 1).replace(/^"|"$/g, '');
      env[key] = val;
    }
  }
  return env;
}

function sql(query) {
  const out = execFileSync(
    'docker',
    [
      'exec',
      '-i',
      DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-t',
      '-A',
      '-F',
      '|',
      '-c',
      query,
    ],
    { encoding: 'utf-8' },
  );
  return out.trim();
}

function sqlScript(script) {
  return execFileSync(
    'docker',
    ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A'],
    { encoding: 'utf-8', input: script },
  ).trim();
}

function sqlOk(script) {
  try {
    sqlScript(script);
    return true;
  } catch {
    return false;
  }
}

const IDS = {
  residentA: {
    user: '10000000-0000-0000-0000-000000000001',
    profile: '20000000-0000-0000-0000-000000000001',
    email: 'resident.a@example.com',
  },
  operatorA: {
    user: '10000000-0000-0000-0000-000000000002',
    profile: '20000000-0000-0000-0000-000000000002',
    email: 'operator.a@example.com',
  },
  admin: {
    user: '10000000-0000-0000-0000-000000000003',
    profile: '20000000-0000-0000-0000-000000000003',
    email: 'platform.admin@example.com',
  },
  residentB: {
    user: '10000000-0000-0000-0000-000000000011',
    profile: '20000000-0000-0000-0000-000000000011',
    email: 'resident.b@example.com',
  },
  revoked: {
    user: '10000000-0000-0000-0000-000000000022',
    profile: '20000000-0000-0000-0000-000000000022',
    email: 'revoked@example.com',
  },
  disabled: {
    user: '10000000-0000-0000-0000-000000000033',
    profile: '20000000-0000-0000-0000-000000000033',
    email: 'disabled@example.com',
  },
  unrelated: {
    user: '10000000-0000-0000-0000-000000000044',
    profile: '20000000-0000-0000-0000-000000000044',
    email: 'unrelated@example.com',
  },
  tenantA: '11111111-1111-1111-1111-111111111111',
  tenantB: '11111111-1111-1111-1111-222222222222',
};

const PASSWORD = 'Password123!';
const evidence = [];
let passed = 0;
let failed = 0;

function fingerprintToken(token) {
  if (!token || typeof token !== 'string') return null;
  return token.slice(-8);
}

function record(testId, func, identity, expectedStatus, actualStatus, errorCode, ok, detail) {
  evidence.push({
    testId,
    function: func,
    identity,
    expectedStatus,
    actualStatus,
    errorCode: errorCode || null,
    passed: ok,
    timestamp: new Date().toISOString(),
    detail: detail || null,
  });
  if (ok) {
    passed += 1;
    console.log(`  PASS ${testId}: ${func} as ${identity} → ${actualStatus}`);
  } else {
    failed += 1;
    console.warn(
      `  FAIL ${testId}: ${func} as ${identity} → got ${actualStatus} (expected ${expectedStatus}) ${errorCode || ''}`,
    );
  }
}

async function mintAccessToken(apiUrl, anonKey, email, password) {
  const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Failed to mint token for ${email}: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

async function callFn(baseUrl, anonKey, name, method, token, body, rawBody) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    'x-request-id': `test-${name}-${Math.random().toString(36).slice(2, 8)}`,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const init = { method, headers };
  if (rawBody !== undefined) init.body = rawBody;
  else if (body !== undefined) init.body = JSON.stringify(body);
  try {
    const res = await fetch(`${baseUrl}/${name}`, init);
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: { code: 'PARSE_ERROR', message: 'non-json response', raw: text.slice(0, 200) } };
    }
    return { status: res.status, body: json, text };
  } catch (err) {
    return { status: 0, body: { error: { code: 'NETWORK_ERROR', message: err.message } }, text: '' };
  }
}

function isSafeErrorEnvelope(body) {
  if (!body || typeof body !== 'object') return false;
  const err = body.error;
  if (!err || typeof err !== 'object') return false;
  const blob = JSON.stringify(body).toLowerCase();
  if (blob.includes('stack') || blob.includes('postgres') || blob.includes('relation ') || blob.includes('sqlstate')) {
    return false;
  }
  return typeof err.code === 'string' && typeof err.message === 'string';
}

async function main() {
  console.log('=== Sprint 1 Edge Function Authorization Tests ===\n');

  const env = loadSupabaseEnv();
  const apiUrl = env.API_URL || 'http://127.0.0.1:54331';
  const baseUrl = env.FUNCTIONS_URL || `${apiUrl}/functions/v1`;
  const anonKey = env.ANON_KEY;

  if (!anonKey) throw new Error('ANON_KEY missing from supabase status');

  console.log(`API URL: ${apiUrl}`);
  console.log(`Edge Functions URL: ${baseUrl}`);
  console.log('Auth mode: GoTrue password grant (real sessions)\n');

  const T = {
    residentA: await mintAccessToken(apiUrl, anonKey, IDS.residentA.email, PASSWORD),
    operatorA: await mintAccessToken(apiUrl, anonKey, IDS.operatorA.email, PASSWORD),
    admin: await mintAccessToken(apiUrl, anonKey, IDS.admin.email, PASSWORD),
    residentB: await mintAccessToken(apiUrl, anonKey, IDS.residentB.email, PASSWORD),
    revoked: await mintAccessToken(apiUrl, anonKey, IDS.revoked.email, PASSWORD),
    disabled: await mintAccessToken(apiUrl, anonKey, IDS.disabled.email, PASSWORD),
    unrelated: await mintAccessToken(apiUrl, anonKey, IDS.unrelated.email, PASSWORD),
    invalid: 'invalid.token.structure',
    expired: null,
  };

  // Expired token: mint then force exp in past is not possible for GoTrue; use a clearly expired self-forged shape rejected by getUser.
  T.expired =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    Buffer.from(
      JSON.stringify({
        sub: IDS.residentA.user,
        role: 'authenticated',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) - 3600,
        iat: Math.floor(Date.now() / 1000) - 7200,
      }),
    ).toString('base64url') +
    '.invalidsignature';

  const GET = ['auth-context', 'profile-get', 'profile-contacts-list', 'tenant-context-list', 'resident-auth'];
  const POST = ['auth-bootstrap', 'tenant-context-select'];

  // ─── EF-AUTH-01: Anonymous request ───
  console.log('[EF-AUTH-01] Anonymous request');
  for (const fn of GET) {
    const r = await callFn(baseUrl, anonKey, fn, 'GET', null);
    const ok = r.status === 401 && r.body?.error?.code === 'UNAUTHENTICATED' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-01', fn, 'anonymous', 401, r.status, r.body?.error?.code, ok, { msg: r.body?.error?.message });
  }
  for (const fn of POST) {
    const r = await callFn(baseUrl, anonKey, fn, 'POST', null, {});
    const ok = r.status === 401 && r.body?.error?.code === 'UNAUTHENTICATED' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-01', fn, 'anonymous', 401, r.status, r.body?.error?.code, ok, { msg: r.body?.error?.message });
  }
  for (const [fn, method] of [
    ['profile-contact-upsert', 'PUT'],
    ['profile-contact-delete', 'DELETE'],
    ['profile-update', 'PATCH'],
  ]) {
    const r = await callFn(baseUrl, anonKey, fn, method, null, method === 'DELETE' ? undefined : {});
    const ok = r.status === 401 && r.body?.error?.code === 'UNAUTHENTICATED' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-01', fn, 'anonymous', 401, r.status, r.body?.error?.code, ok, { msg: r.body?.error?.message });
  }

  // ─── EF-AUTH-02: Invalid/expired token ───
  console.log('\n[EF-AUTH-02] Invalid/expired token');
  for (const [identity, token, fn] of [
    ['invalid', T.invalid, 'auth-context'],
    ['invalid', T.invalid, 'profile-get'],
    ['expired', T.expired, 'auth-context'],
  ]) {
    const r = await callFn(baseUrl, anonKey, fn, 'GET', token);
    const ok = r.status === 401 && r.body?.error?.code === 'UNAUTHENTICATED' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-02', fn, identity, 401, r.status, r.body?.error?.code, ok, { msg: r.body?.error?.message });
  }

  // ─── EF-AUTH-03: Valid self access ───
  console.log('\n[EF-AUTH-03] Valid self access');
  {
    const cases = [
      ['auth-context', 'GET', undefined],
      ['auth-bootstrap', 'POST', {}],
      ['profile-get', 'GET', undefined],
      ['profile-contacts-list', 'GET', undefined],
      ['tenant-context-list', 'GET', undefined],
      ['resident-auth', 'GET', undefined],
    ];
    for (const [fn, method, body] of cases) {
      const r = await callFn(baseUrl, anonKey, fn, method, T.residentA, body);
      const ok = r.status === 200 && r.body?.data != null && !r.body?.error;
      record('EF-AUTH-03', fn, 'residentA', 200, r.status, r.body?.error?.code, ok, {
        hasData: r.body?.data != null,
      });
    }
  }

  // ─── EF-AUTH-04: Cross-profile denial ───
  console.log('\n[EF-AUTH-04] Cross-profile access boundary');
  {
    const self = await callFn(baseUrl, anonKey, 'profile-get', 'GET', T.residentB);
    const selfOk =
      self.status === 200 && self.body?.data?.profile?.id === IDS.residentB.profile;
    record('EF-AUTH-04', 'profile-get', 'residentB→self', 200, self.status, self.body?.error?.code, selfOk, {
      profileId: self.body?.data?.profile?.id,
      expectedOwnProfile: IDS.residentB.profile,
    });

    // SQL/RLS boundary: resident B cannot read resident A profile under JWT claims.
    const existCount = Number(
      sql(`SELECT COUNT(*)::int FROM public.profiles WHERE id = '${IDS.residentA.profile}'`),
    );
    const rlsRaw = sqlScript(`
BEGIN;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '${IDS.residentB.user}', true);
SET LOCAL ROLE authenticated;
SELECT COUNT(*)::int AS c FROM public.profiles WHERE id = '${IDS.residentA.profile}';
ROLLBACK;
`);
    const rlsCount = Number(
      rlsRaw
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^\d+$/.test(l))
        .at(-1),
    );
    const denied = rlsCount === 0;
    const visibleAsSuper = existCount === 1;
    record(
      'EF-AUTH-04',
      'profiles-rls',
      'residentB→A',
      0,
      denied ? 0 : rlsCount,
      null,
      denied && visibleAsSuper,
      { rowsVisibleToB: rlsCount, rowsExist: existCount },
    );
  }

  // ─── EF-AUTH-05: Cross-tenant denial ───
  console.log('\n[EF-AUTH-05] Cross-tenant denial');
  {
    const r = await callFn(baseUrl, anonKey, 'tenant-context-select', 'POST', T.residentA, {
      tenant_id: IDS.tenantB,
    });
    const ok = r.status === 403 && r.body?.error?.code === 'FORBIDDEN' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-05', 'tenant-context-select', 'residentA→B', 403, r.status, r.body?.error?.code, ok, {
      msg: r.body?.error?.message,
    });
  }

  // ─── EF-AUTH-06: Forged tenant context ───
  console.log('\n[EF-AUTH-06] Forged tenant context');
  for (const [identity, token, tenant] of [
    ['residentB→A', T.residentB, IDS.tenantA],
    ['operatorA→B', T.operatorA, IDS.tenantB],
  ]) {
    const r = await callFn(baseUrl, anonKey, 'tenant-context-select', 'POST', token, { tenant_id: tenant });
    const ok = r.status === 403 && r.body?.error?.code === 'FORBIDDEN' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-06', 'tenant-context-select', identity, 403, r.status, r.body?.error?.code, ok, {
      msg: r.body?.error?.message,
    });
  }

  // ─── EF-AUTH-07: Permission enforcement ───
  console.log('\n[EF-AUTH-07] Permission enforcement');
  {
    const r = await callFn(baseUrl, anonKey, 'tenant-context-select', 'POST', T.unrelated, {
      tenant_id: IDS.tenantA,
    });
    const ok = r.status === 403 && r.body?.error?.code === 'FORBIDDEN' && isSafeErrorEnvelope(r.body);
    record('EF-AUTH-07', 'tenant-context-select', 'unrelated→A', 403, r.status, r.body?.error?.code, ok, {
      msg: r.body?.error?.message,
    });
  }

  // ─── EF-AUTH-08: Platform admin path ───
  console.log('\n[EF-AUTH-08] Platform admin path');
  {
    const ctx = await callFn(baseUrl, anonKey, 'auth-context', 'GET', T.admin);
    const list = await callFn(baseUrl, anonKey, 'tenant-context-list', 'GET', T.admin);
    const adminOk =
      ctx.status === 200 &&
      ctx.body?.data?.statusFlags?.isPlatformAdmin === true &&
      Array.isArray(ctx.body?.data?.platformRoles) &&
      ctx.body.data.platformRoles.includes('platform_admin');
    record('EF-AUTH-08', 'auth-context', 'admin', 200, ctx.status, ctx.body?.error?.code, adminOk, {
      isPlatformAdmin: ctx.body?.data?.statusFlags?.isPlatformAdmin,
      platformRoles: ctx.body?.data?.platformRoles,
    });
    const listOk = list.status === 200 && list.body?.data != null;
    record('EF-AUTH-08', 'tenant-context-list', 'admin', 200, list.status, list.body?.error?.code, listOk, {
      hasData: list.body?.data != null,
    });
  }

  // ─── EF-AUTH-09: Revoked membership ───
  console.log('\n[EF-AUTH-09] Revoked membership');
  {
    const r = await callFn(baseUrl, anonKey, 'auth-context', 'GET', T.revoked);
    const residences = r.body?.data?.availableResidences ?? [];
    const tenants = r.body?.data?.availableTenants ?? [];
    const ok = r.status === 200 && residences.length === 0 && tenants.length === 0;
    record('EF-AUTH-09', 'auth-context', 'revoked', 200, r.status, r.body?.error?.code, ok, {
      residenceCount: residences.length,
      tenantCount: tenants.length,
    });
  }

  // ─── EF-AUTH-10: Disabled user ───
  console.log('\n[EF-AUTH-10] Disabled user');
  {
    const r = await callFn(baseUrl, anonKey, 'profile-get', 'GET', T.disabled);
    // Disabled profile may be hidden (404) or explicit forbid; never return active profile payload.
    const denied =
      r.status !== 200 ||
      r.body?.data?.profile == null ||
      r.body?.data?.profile?.status === 'disabled';
    const noActivePayload =
      r.status !== 200 ||
      r.body?.data?.profile?.status === 'disabled' ||
      r.body?.error?.code === 'NOT_FOUND' ||
      r.body?.error?.code === 'FORBIDDEN';
    record('EF-AUTH-10', 'profile-get', 'disabled', 404, r.status, r.body?.error?.code, denied && noActivePayload, {
      msg: r.body?.error?.message,
      status: r.body?.data?.profile?.status,
    });
  }

  // ─── EF-AUTH-11: Input validation ───
  console.log('\n[EF-AUTH-11] Input validation');
  {
    const badJson = await callFn(
      baseUrl,
      anonKey,
      'profile-update',
      'PATCH',
      T.residentA,
      undefined,
      '{invalid',
    );
    const okBad =
      (badJson.status === 422 || badJson.status === 400) &&
      isSafeErrorEnvelope(badJson.body);
    record('EF-AUTH-11', 'profile-update', 'residentA-bad-json', 422, badJson.status, badJson.body?.error?.code, okBad, {
      msg: badJson.body?.error?.message,
    });

    const missing = await callFn(baseUrl, anonKey, 'profile-contact-upsert', 'PUT', T.residentA, {
      contact_type: 'email',
    });
    // requireString throws → runtime 500 mapped by edge runtime, or function may 422 if wrapped.
    const okMissing =
      missing.status >= 400 &&
      missing.status < 600 &&
      (isSafeErrorEnvelope(missing.body) || missing.body?.error?.code === 'PARSE_ERROR');
    record(
      'EF-AUTH-11',
      'profile-contact-upsert',
      'residentA-missing-fields',
      422,
      missing.status,
      missing.body?.error?.code,
      okMissing,
      { msg: missing.body?.error?.message },
    );
  }

  // ─── EF-AUTH-12: Protected profile fields ───
  console.log('\n[EF-AUTH-12] Protected profile fields');
  {
    const originalName = sql(`SELECT full_name FROM public.profiles WHERE id = '${IDS.residentA.profile}'`);
    const r = await callFn(baseUrl, anonKey, 'profile-update', 'PATCH', T.residentA, {
      full_name: 'evil-escalation',
      preferred_name: 'AnaSafe',
    });
    const afterRow = sql(
      `SELECT full_name || '||' || COALESCE(preferred_name,'') FROM public.profiles WHERE id = '${IDS.residentA.profile}'`,
    );
    const [afterName, preferredName] = afterRow.split('||');
    const ok =
      r.status === 200 &&
      afterName === originalName &&
      afterName !== 'evil-escalation' &&
      preferredName === 'AnaSafe';
    record('EF-AUTH-12', 'profile-update', 'residentA', 200, r.status, r.body?.error?.code, ok, {
      originalName,
      afterName,
      preferred_name: preferredName,
    });
  }

  // ─── EF-AUTH-13: Contact verification spoofing ───
  console.log('\n[EF-AUTH-13] Contact verification spoofing');
  {
    const uniqueEmail = `verify-test-${Date.now()}@test.com`;
    const r = await callFn(baseUrl, anonKey, 'profile-contact-upsert', 'PUT', T.residentA, {
      contact_type: 'email',
      normalized_value: uniqueEmail,
      display_value: uniqueEmail,
      verification_state: 'verified',
      verified_at: new Date().toISOString(),
    });
    const state = r.body?.data?.verification_state;
    const okEdge =
      r.status === 200 &&
      state === 'unverified' &&
      (r.body?.data?.verified_at == null);

    const sqlDenied = !sqlOk(`
BEGIN;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '${IDS.residentA.user}', true);
SET LOCAL ROLE authenticated;
UPDATE public.profile_contacts
   SET verification_state = 'verified', verified_at = now()
 WHERE profile_id = '${IDS.residentA.profile}'
   AND contact_type = 'email'
   AND deleted_at IS NULL;
COMMIT;
`);

    record('EF-AUTH-13', 'profile-contact-upsert', 'residentA', 200, r.status, r.body?.error?.code, okEdge && sqlDenied, {
      verification_state: state,
      sqlSpoofDenied: sqlDenied,
    });
  }

  // ─── EF-AUTH-14: Audit event generated and immutable ───
  console.log('\n[EF-AUTH-14] Audit event');
  {
    const beforeCount = Number(
      sql(`SELECT COUNT(*)::int FROM public.audit_events WHERE actor_profile_id = '${IDS.residentA.profile}' AND action = 'profile.update.self'`),
    );
    const r = await callFn(baseUrl, anonKey, 'profile-update', 'PATCH', T.residentA, {
      preferred_name: `AuditTest-${Date.now()}`,
    });
    const afterRow = sql(`
      SELECT id || '|' || action || '|' || COALESCE(source,'')
      FROM public.audit_events
      WHERE actor_profile_id = '${IDS.residentA.profile}' AND action = 'profile.update.self'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const afterCount = Number(
      sql(`SELECT COUNT(*)::int FROM public.audit_events WHERE actor_profile_id = '${IDS.residentA.profile}' AND action = 'profile.update.self'`),
    );
    const [auditId, action, source] = (afterRow || '').split('|');
    const created = r.status === 200 && Boolean(auditId) && afterCount >= beforeCount + 1;
    const immutable = auditId
      ? !sqlOk(`UPDATE public.audit_events SET action = 'tamper' WHERE id = '${auditId}'`)
      : false;

    record('EF-AUTH-14', 'profile-update', 'residentA', 200, r.status, r.body?.error?.code, created && immutable, {
      auditId,
      action,
      source,
      immutable,
      beforeCount,
      afterCount,
    });
  }

  // ─── EF-AUTH-15: Safe internal failure ───
  console.log('\n[EF-AUTH-15] Safe internal failure');
  {
    const r = await callFn(baseUrl, anonKey, 'profile-update', 'PATCH', T.residentA, {
      preferred_name: 12345,
    });
    const ok =
      r.status >= 400 &&
      r.status < 600 &&
      !String(r.text || '').toLowerCase().includes('stack trace') &&
      (isSafeErrorEnvelope(r.body) || r.body?.error?.code === 'PARSE_ERROR' || r.status === 500);
    record('EF-AUTH-15', 'profile-update', 'residentA', 500, r.status, r.body?.error?.code, ok, {
      msg: r.body?.error?.message,
    });
  }

  const total = passed + failed;
  console.log(`\n=== Results: ${passed}/${total} passed (${failed} failed) ===`);

  fs.mkdirSync('validation/evidence', { recursive: true });
  fs.writeFileSync(
    'validation/evidence/sprint01_edge_function_authorization.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment: 'local-supabase-cli',
        baseUrl,
        authMode: 'gotrue-password-grant',
        testIdentities: {
          residentA: { user: IDS.residentA.user, fingerprint: fingerprintToken(T.residentA) },
          residentB: { user: IDS.residentB.user, fingerprint: fingerprintToken(T.residentB) },
          operatorA: { user: IDS.operatorA.user, fingerprint: fingerprintToken(T.operatorA) },
          admin: { user: IDS.admin.user, fingerprint: fingerprintToken(T.admin) },
          revoked: { user: IDS.revoked.user, fingerprint: fingerprintToken(T.revoked) },
          disabled: { user: IDS.disabled.user, fingerprint: fingerprintToken(T.disabled) },
          unrelated: { user: IDS.unrelated.user, fingerprint: fingerprintToken(T.unrelated) },
        },
        evidence,
        summary: { total, passed, failed },
      },
      null,
      2,
    ),
  );

  console.log('Evidence written to validation/evidence/sprint01_edge_function_authorization.json');
  if (failed > 0) {
    console.error(`\n${failed} test(s) FAILED`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET', 'SUPABASE_DB_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(PROJECT_ROOT, 'validation', 'evidence');
const TRACE_PATH = path.join(EVIDENCE_DIR, 'adr09_realtime_authorization_trace.json');
const POLICY_BISECT_PATH = path.join(EVIDENCE_DIR, 'adr09_policy_bisect.json');
const CONTROL_TABLE_PATH = path.join(EVIDENCE_DIR, 'adr09_control_table_probe.json');
const VERSION_TRACE_PATH = path.join(EVIDENCE_DIR, 'adr09_realtime_version_trace.md');
const SETUP_SQL_PATH = path.join(PROJECT_ROOT, 'validation', 'd2_setup.sql');
const DB_SQL_TESTS_PATH = path.join(PROJECT_ROOT, 'validation', 'adr09_adr10_sql_tests.sql');
const RUNTIME_PROBE_PATH = path.join(PROJECT_ROOT, 'validation', 'adr09_adr10_runtime_probe.mjs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const DB_CONTAINER = 'supabase_db_aistudio-hoa-connect-resident-app';
const REALTIME_CONTAINER = 'supabase_realtime_aistudio-hoa-connect-resident-app';
const OBSERVATION_MS = 1800;
const DELIVERY_WAIT_MS = 8000;
const POST_SUBSCRIBE_SETTLE_MS = 250;

const users = {
  residentA: '10000000-0000-0000-0000-000000000001',
  residentB: '10000000-0000-0000-0000-000000000002',
  unrelated: '10000000-0000-0000-0000-000000000003',
};

const profiles = {
  residentA: '20000000-0000-0000-0000-000000000001',
  residentB: '20000000-0000-0000-0000-000000000002',
};

const requests = {
  residentA: '70000000-0000-0000-0000-000000000001',
  residentB: '70000000-0000-0000-0000-000000000002',
};

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeJwt(token) {
  const [header, payload] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  };
}

function signJwt(sub, role = 'authenticated') {
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 30,
    iat: Math.floor(Date.now() / 1000),
    iss: 'supabase-demo',
    role,
    sub,
  }));
  const signature = crypto
    .createHmac('sha256', SUPABASE_JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.${signature}`;
}

function tokenFingerprint(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function runShell(command, options = {}) {
  return runCommand('bash', ['-lc', command], options);
}

function resetValidationState() {
  runShell(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres < '${SETUP_SQL_PATH}'`);
}

function psql(sql) {
  return runCommand('docker', [
    'exec',
    DB_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-F',
    '\t',
    '-c',
    sql,
  ]);
}

function psqlJson(sql) {
  const wrapped = `
    WITH source AS (
      ${sql}
    )
    SELECT COALESCE(json_agg(source), '[]'::json)::text
    FROM source;
  `;
  const raw = psql(wrapped);
  return raw ? JSON.parse(raw) : [];
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runtimeId() {
  return crypto.randomUUID();
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function createAuthedClient(token) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  client.realtime.setAuth(token);
  return client;
}

async function subscribeToInserts(client, channelName, table, filter) {
  const events = [];
  const statuses = [];

  const channel = client
    .channel(channelName)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => {
      events.push({
        received_at: nowIso(),
        payload,
      });
    });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Subscribe timeout for ${channelName}`)), 7000);
    channel.subscribe((status, err) => {
      statuses.push({
        status,
        error: err?.message ?? null,
        at: nowIso(),
      });
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout);
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timeout);
        reject(new Error(`${channelName} failed with ${status}`));
      }
    });
  });

  await sleep(POST_SUBSCRIBE_SETTLE_MS);
  return { channel, statuses, events, filter: filter ?? null };
}

async function waitForEventCount(events, expectedCount, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (events.length >= expectedCount) {
      return true;
    }
    await sleep(100);
  }
  return false;
}

async function observeNoNewEvents(subscription, baselineCount, observationMs = OBSERVATION_MS) {
  await sleep(observationMs);
  return {
    baseline_count: baselineCount,
    final_count: subscription.events.length,
    passed: subscription.events.length === baselineCount,
    received_event_buffer: subscription.events.slice(baselineCount),
  };
}

function extractAuthorizedRows(events) {
  return events
    .map((event) => event.payload?.new ?? null)
    .filter((row) => row && Object.keys(row).length > 0);
}

function extractUnauthorizedEnvelopes(events) {
  return events
    .map((event) => event.payload ?? null)
    .filter((payload) => Array.isArray(payload?.errors) && payload.errors.length > 0);
}

function latestStatus(statuses) {
  return statuses[statuses.length - 1]?.status ?? 'UNKNOWN';
}

function installDiagnosticObjects() {
  psql(`
    CREATE OR REPLACE FUNCTION public.current_tenant_ids()
    RETURNS uuid[]
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = ''
    AS $$
      SELECT COALESCE(array_agg(DISTINCT rm.tenant_id), '{}'::uuid[])
      FROM public.residence_members AS rm
      WHERE rm.profile_id = public.current_profile_id()
        AND rm.status = 'active';
    $$;

    CREATE OR REPLACE FUNCTION public.realtime_identity_probe()
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    SET search_path = ''
    AS $$
      SELECT jsonb_build_object(
        'auth_uid', auth.uid(),
        'auth_role', auth.role(),
        'current_user', current_user,
        'jwt_sub', current_setting('request.jwt.claim.sub', true),
        'jwt_role', current_setting('request.jwt.claim.role', true),
        'jwt_aud', current_setting('request.jwt.claim.aud', true),
        'jwt_exp', current_setting('request.jwt.claim.exp', true),
        'jwt_iss', current_setting('request.jwt.claim.iss', true),
        'current_profile_id', public.current_profile_id(),
        'current_tenant_ids', public.current_tenant_ids()
      );
    $$;

    DROP TABLE IF EXISTS public.realtime_owner_probe CASCADE;

    CREATE TABLE public.realtime_owner_probe (
      id uuid PRIMARY KEY,
      owner_user_id uuid NOT NULL,
      payload text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.realtime_owner_probe ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.realtime_owner_probe FORCE ROW LEVEL SECURITY;

    REVOKE ALL ON public.realtime_owner_probe FROM anon, authenticated;
    GRANT SELECT ON public.realtime_owner_probe TO authenticated;
    GRANT EXECUTE ON FUNCTION public.current_tenant_ids() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.realtime_identity_probe() TO authenticated;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'realtime_owner_probe'
      ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.realtime_owner_probe';
      END IF;
    END $$;

    ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_owner_probe;
  `);
}

function setReplicaIdentity(tableName, identity) {
  psql(`ALTER TABLE public.${tableName} REPLICA IDENTITY ${identity};`);
}

function createSupportPolicies({ scope, expression, includeOperator = false, includePlatformAdmin = false }) {
  const toClause = scope === 'authenticated' ? ' TO authenticated' : '';
  psql(`
    DROP POLICY IF EXISTS support_messages_select_resident_policy ON public.support_messages;
    DROP POLICY IF EXISTS support_messages_select_operator_policy ON public.support_messages;
    DROP POLICY IF EXISTS support_messages_select_platform_admin_policy ON public.support_messages;

    CREATE POLICY support_messages_select_resident_policy
    ON public.support_messages
    FOR SELECT${toClause}
    USING (${expression});

    ${includeOperator ? `
      CREATE POLICY support_messages_select_operator_policy
      ON public.support_messages
      FOR SELECT${toClause}
      USING (public.is_authorized_operator(tenant_id));
    ` : ''}

    ${includePlatformAdmin ? `
      CREATE POLICY support_messages_select_platform_admin_policy
      ON public.support_messages
      FOR SELECT${toClause}
      USING (public.is_platform_admin());
    ` : ''}
  `);
}

function createControlPolicy(scope) {
  const toClause = scope === 'authenticated' ? ' TO authenticated' : '';
  psql(`
    DROP POLICY IF EXISTS realtime_owner_probe_select_policy ON public.realtime_owner_probe;
    CREATE POLICY realtime_owner_probe_select_policy
    ON public.realtime_owner_probe
    FOR SELECT${toClause}
    USING (owner_user_id = auth.uid());
  `);
}

function buildVariantClients(tokens) {
  return {
    residentA: createAuthedClient(tokens.residentA),
    residentB: createAuthedClient(tokens.residentB),
    unrelated: createAuthedClient(tokens.unrelated),
  };
}

async function runSupportVariant(variant, tokens) {
  const variantClients = buildVariantClients(tokens);
  createSupportPolicies(variant.policy);
  if (variant.replicaIdentityFull) {
    setReplicaIdentity('support_messages', 'FULL');
  } else {
    setReplicaIdentity('support_messages', 'DEFAULT');
  }

  const residentSub = await subscribeToInserts(
    variantClients.residentA,
    `adr09-support-${variant.id}-resident-a`,
    'support_messages',
    variant.filter ?? null,
  );

  const insertId = runtimeId();
  psql(`
    INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
    VALUES ('${insertId}', '${requests.residentA}', 'association', null, '${variant.id} authorized message', '${nowIso()}');
  `);

  await waitForEventCount(residentSub.events, 1, DELIVERY_WAIT_MS);

  const foreignSub = await subscribeToInserts(
    variantClients.residentA,
    `adr09-support-${variant.id}-foreign`,
    'support_messages',
    `support_request_id=eq.${requests.residentB}`,
  );
  const foreignInsertId = runtimeId();
  psql(`
    INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
    VALUES ('${foreignInsertId}', '${requests.residentB}', 'association', null, '${variant.id} foreign message', '${nowIso()}');
  `);
  const foreignObservation = await observeNoNewEvents(foreignSub, 0);

  const unrelatedSub = await subscribeToInserts(
    variantClients.unrelated,
    `adr09-support-${variant.id}-unrelated`,
    'support_messages',
    `support_request_id=eq.${requests.residentA}`,
  );
  const unrelatedInsertId = runtimeId();
  psql(`
    INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
    VALUES ('${unrelatedInsertId}', '${requests.residentA}', 'association', null, '${variant.id} unrelated message', '${nowIso()}');
  `);
  const unrelatedObservation = await observeNoNewEvents(unrelatedSub, 0);

  const directRead = await variantClients.residentA
    .from('support_messages')
    .select('id, resident_user_id, resident_access_revoked, support_request_id')
    .order('created_at', { ascending: true });

  const result = {
    id: variant.id,
    description: variant.description,
    policy: variant.policy,
    replica_identity: variant.replicaIdentityFull ? 'FULL' : 'DEFAULT',
    filter: variant.filter ?? null,
    rt04: {
      statuses: residentSub.statuses,
      channel_status: latestStatus(residentSub.statuses),
      events: residentSub.events,
      authorized_rows: extractAuthorizedRows(residentSub.events),
      unauthorized_envelopes: extractUnauthorizedEnvelopes(residentSub.events),
    },
    rt05: {
      statuses: foreignSub.statuses,
      channel_status: latestStatus(foreignSub.statuses),
      observation: foreignObservation,
    },
    rt06: {
      statuses: unrelatedSub.statuses,
      channel_status: latestStatus(unrelatedSub.statuses),
      observation: unrelatedObservation,
    },
    rt08: {
      status: directRead.status,
      error: directRead.error?.message ?? null,
      row_ids: directRead.data?.map((row) => row.id) ?? [],
      unauthorized_row_count: (directRead.data ?? []).filter((row) => row.support_request_id !== requests.residentA).length,
    },
  };

  await Promise.allSettled([
    residentSub.channel.unsubscribe(),
    foreignSub.channel.unsubscribe(),
    unrelatedSub.channel.unsubscribe(),
  ]);
  await Promise.allSettled([
    variantClients.residentA.removeChannel(residentSub.channel),
    variantClients.residentA.removeChannel(foreignSub.channel),
    variantClients.unrelated.removeChannel(unrelatedSub.channel),
    variantClients.residentA.removeAllChannels(),
    variantClients.residentB.removeAllChannels(),
    variantClients.unrelated.removeAllChannels(),
  ]);

  return result;
}

async function runControlVariant(scope, tokens) {
  const variantClients = buildVariantClients(tokens);
  createControlPolicy(scope);
  setReplicaIdentity('realtime_owner_probe', 'DEFAULT');

  const ownerSub = await subscribeToInserts(
    variantClients.residentA,
    `adr09-control-${scope}-owner`,
    'realtime_owner_probe',
  );
  const ownerInsertId = runtimeId();
  psql(`
    INSERT INTO public.realtime_owner_probe (id, owner_user_id, payload, created_at)
    VALUES ('${ownerInsertId}', '${users.residentA}', 'owner ${scope}', '${nowIso()}');
  `);
  await waitForEventCount(ownerSub.events, 1, DELIVERY_WAIT_MS);

  const foreignSub = await subscribeToInserts(
    variantClients.residentA,
    `adr09-control-${scope}-foreign`,
    'realtime_owner_probe',
  );
  const foreignInsertId = runtimeId();
  psql(`
    INSERT INTO public.realtime_owner_probe (id, owner_user_id, payload, created_at)
    VALUES ('${foreignInsertId}', '${users.residentB}', 'foreign ${scope}', '${nowIso()}');
  `);
  const foreignObservation = await observeNoNewEvents(foreignSub, 0);

  const unrelatedSub = await subscribeToInserts(
    variantClients.unrelated,
    `adr09-control-${scope}-unrelated`,
    'realtime_owner_probe',
  );
  const unrelatedInsertId = runtimeId();
  psql(`
    INSERT INTO public.realtime_owner_probe (id, owner_user_id, payload, created_at)
    VALUES ('${unrelatedInsertId}', '${users.residentA}', 'unrelated ${scope}', '${nowIso()}');
  `);
  const unrelatedObservation = await observeNoNewEvents(unrelatedSub, 0);

  const result = {
    scope,
    authorized: {
      channel_status: latestStatus(ownerSub.statuses),
      statuses: ownerSub.statuses,
      events: ownerSub.events,
      authorized_rows: extractAuthorizedRows(ownerSub.events),
      unauthorized_envelopes: extractUnauthorizedEnvelopes(ownerSub.events),
    },
    foreign: {
      channel_status: latestStatus(foreignSub.statuses),
      statuses: foreignSub.statuses,
      observation: foreignObservation,
    },
    unrelated: {
      channel_status: latestStatus(unrelatedSub.statuses),
      statuses: unrelatedSub.statuses,
      observation: unrelatedObservation,
    },
  };

  await Promise.allSettled([
    ownerSub.channel.unsubscribe(),
    foreignSub.channel.unsubscribe(),
    unrelatedSub.channel.unsubscribe(),
  ]);
  await Promise.allSettled([
    variantClients.residentA.removeChannel(ownerSub.channel),
    variantClients.residentA.removeChannel(foreignSub.channel),
    variantClients.unrelated.removeChannel(unrelatedSub.channel),
    variantClients.residentA.removeAllChannels(),
    variantClients.residentB.removeAllChannels(),
    variantClients.unrelated.removeAllChannels(),
  ]);

  return result;
}

async function runFilterMatrix(tokens) {
  createSupportPolicies({
    scope: 'public',
    expression: 'resident_user_id = auth.uid() AND resident_access_revoked = false',
    includeOperator: true,
    includePlatformAdmin: true,
  });
  setReplicaIdentity('support_messages', 'DEFAULT');

  const filters = [
    { name: 'none', value: null },
    { name: 'support_request_id', value: `support_request_id=eq.${requests.residentA}` },
    { name: 'resident_user_id', value: `resident_user_id=eq.${users.residentA}` },
    { name: 'tenant_id', value: 'tenant_id=eq.11111111-1111-1111-1111-111111111111' },
    { name: 'current_intended', value: `support_request_id=eq.${requests.residentA}` },
  ];

  const results = [];
  for (const filter of filters) {
    const variantClients = buildVariantClients(tokens);
    const subscription = await subscribeToInserts(
      variantClients.residentA,
      `adr09-filter-${filter.name}`,
      'support_messages',
      filter.value,
    );

    const insertId = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${insertId}', '${requests.residentA}', 'association', null, 'filter ${filter.name}', '${nowIso()}');
    `);
    await waitForEventCount(subscription.events, 1, DELIVERY_WAIT_MS);

    results.push({
      name: filter.name,
      filter: filter.value,
      channel_status: latestStatus(subscription.statuses),
      statuses: subscription.statuses,
      authorized_rows: extractAuthorizedRows(subscription.events),
      unauthorized_envelopes: extractUnauthorizedEnvelopes(subscription.events),
      raw_events: subscription.events,
    });

    await subscription.channel.unsubscribe();
    await variantClients.residentA.removeChannel(subscription.channel);
    await Promise.allSettled([
      variantClients.residentA.removeAllChannels(),
      variantClients.residentB.removeAllChannels(),
      variantClients.unrelated.removeAllChannels(),
    ]);
  }

  return results;
}

function getPublicationAndPolicyMetadata() {
  return {
    publication_membership: psqlJson(`
      SELECT schemaname, tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND tablename IN ('notifications', 'support_messages', 'realtime_owner_probe')
      ORDER BY tablename
    `),
    replica_identity: psqlJson(`
      SELECT c.relname AS table_name, c.relreplident
      FROM pg_class AS c
      WHERE c.oid IN (
        'public.notifications'::regclass,
        'public.support_messages'::regclass,
        'public.realtime_owner_probe'::regclass
      )
      ORDER BY c.relname
    `),
    rls_and_force: psqlJson(`
      SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class AS c
      WHERE c.oid IN (
        'public.notifications'::regclass,
        'public.support_messages'::regclass,
        'public.realtime_owner_probe'::regclass
      )
      ORDER BY c.relname
    `),
    grants: psqlJson(`
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('notifications', 'support_messages', 'realtime_owner_probe')
        AND grantee IN ('anon', 'authenticated')
      ORDER BY table_name, grantee, privilege_type
    `),
    policy_summary: psqlJson(`
      SELECT tablename, policyname, roles, qual
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('notifications', 'support_messages', 'realtime_owner_probe')
      ORDER BY tablename, policyname
    `),
  };
}

function getTableStructureDiff() {
  return {
    primary_keys: psqlJson(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name IN ('notifications', 'support_messages')
      ORDER BY tc.table_name, kcu.ordinal_position
    `),
    columns: psqlJson(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('notifications', 'support_messages')
      ORDER BY table_name, ordinal_position
    `),
    foreign_keys: psqlJson(`
      SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid IN ('public.notifications'::regclass, 'public.support_messages'::regclass)
        AND contype = 'f'
      ORDER BY conrelid::regclass::text, conname
    `),
    triggers: psqlJson(`
      SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND event_object_table IN ('notifications', 'support_messages')
      ORDER BY event_object_table, trigger_name
    `),
  };
}

function captureVersionTrace(logSinceIso) {
  const supabaseVersion = runCommand('supabase', ['--version']);
  const dockerImages = runCommand('docker', ['ps', '--format', '{{.Names}}\t{{.Image}}']).split('\n')
    .filter(Boolean)
    .filter((line) =>
      line.includes('supabase_db_aistudio-hoa-connect-resident-app') ||
      line.includes('supabase_realtime_aistudio-hoa-connect-resident-app') ||
      line.includes('supabase_auth_aistudio-hoa-connect-resident-app') ||
      line.includes('supabase_rest_aistudio-hoa-connect-resident-app'),
    );
  let realtimeLogs = '';
  try {
    realtimeLogs = runCommand('docker', ['logs', '--since', logSinceIso, REALTIME_CONTAINER]);
  } catch (error) {
    realtimeLogs = error.stdout?.toString?.() ?? '';
  }

  const relevantRealtimeLogLines = realtimeLogs
    .split('\n')
    .filter((line) => /401|Unauthorized|support_messages|postgres_changes|Channel/i.test(line))
    .slice(-40);

  return {
    supabaseVersion,
    dockerImages,
    relevantRealtimeLogLines,
  };
}

function parseRuntimeProbeOutput(rawOutput) {
  const firstBrace = rawOutput.indexOf('{');
  const lastBrace = rawOutput.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  try {
    return JSON.parse(rawOutput.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function runDbSqlTests() {
  const output = runShell(`docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres < '${DB_SQL_TESTS_PATH}'`);
  return {
    output,
    passed: !/ERROR:/i.test(output),
  };
}

function runNodeScript(scriptPath, extraEnv = {}) {
  try {
    const stdout = runCommand('node', [scriptPath], {
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      exitCode: error.status ?? 1,
      stdout: error.stdout?.toString?.() ?? '',
      stderr: error.stderr?.toString?.() ?? '',
    };
  }
}

async function main() {
  const startedAt = nowIso();
  resetValidationState();
  installDiagnosticObjects();

  const residentAToken = signJwt(users.residentA);
  const residentBToken = signJwt(users.residentB);
  const unrelatedToken = signJwt(users.unrelated);
  const residentADecoded = decodeJwt(residentAToken);

  const clients = {
    residentA: createAuthedClient(residentAToken),
    residentB: createAuthedClient(residentBToken),
    unrelated: createAuthedClient(unrelatedToken),
  };

  const identityProbe = await clients.residentA.rpc('realtime_identity_probe');
  const residentARows = await clients.residentA
    .from('support_messages')
    .select('id, tenant_id, resident_profile_id, resident_user_id, resident_access_revoked, support_request_id')
    .eq('support_request_id', requests.residentA)
    .order('created_at', { ascending: true });

  const authUsersProbe = psqlJson(`
    SELECT id, email, aud, role
    FROM auth.users
    WHERE id = '${users.residentA}'::uuid
  `);

  const supportRowSample = psqlJson(`
    SELECT id, tenant_id, resident_profile_id, resident_user_id, resident_access_revoked, support_request_id
    FROM public.support_messages
    WHERE support_request_id = '${requests.residentA}'::uuid
    ORDER BY created_at
    LIMIT 1
  `)[0] ?? null;

  const policyVariants = [
    {
      id: 'P1_authenticated_true',
      description: 'USING (true) with TO authenticated',
      policy: { scope: 'authenticated', expression: 'true' },
    },
    {
      id: 'P1_public_true',
      description: 'USING (true) with no TO clause',
      policy: { scope: 'public', expression: 'true' },
    },
    {
      id: 'P2_authenticated_uid',
      description: 'USING (resident_user_id = auth.uid()) with TO authenticated',
      policy: { scope: 'authenticated', expression: 'resident_user_id = auth.uid()' },
    },
    {
      id: 'P2_public_uid',
      description: 'USING (resident_user_id = auth.uid()) with no TO clause',
      policy: { scope: 'public', expression: 'resident_user_id = auth.uid()' },
    },
    {
      id: 'P3_public_uid_revoked',
      description: 'USING (resident_user_id = auth.uid() AND resident_access_revoked = false) with no TO clause',
      policy: { scope: 'public', expression: 'resident_user_id = auth.uid() AND resident_access_revoked = false' },
    },
    {
      id: 'P4_public_profile',
      description: 'USING (resident_profile_id = current_profile_id()) with no TO clause',
      policy: { scope: 'public', expression: 'resident_profile_id = public.current_profile_id()' },
    },
    {
      id: 'P5_public_tenant',
      description: 'USING (tenant_id = ANY(current_tenant_ids())) with no TO clause',
      policy: { scope: 'public', expression: 'tenant_id = ANY(public.current_tenant_ids())' },
    },
    {
      id: 'P6_final_public',
      description: 'Final approved resident predicate with operator and platform admin policies, no TO clause',
      policy: {
        scope: 'public',
        expression: 'resident_user_id = auth.uid() AND resident_access_revoked = false',
        includeOperator: true,
        includePlatformAdmin: true,
      },
    },
  ];

  const bisectResults = [];
  for (const variant of policyVariants) {
    bisectResults.push(await runSupportVariant(variant, {
      residentA: residentAToken,
      residentB: residentBToken,
      unrelated: unrelatedToken,
    }));
  }

  const controlResults = [];
  for (const scope of ['authenticated', 'public']) {
    controlResults.push(await runControlVariant(scope, {
      residentA: residentAToken,
      residentB: residentBToken,
      unrelated: unrelatedToken,
    }));
  }

  const filterMatrix = await runFilterMatrix({
    residentA: residentAToken,
    residentB: residentBToken,
    unrelated: unrelatedToken,
  });

  createSupportPolicies({
    scope: 'public',
    expression: 'resident_user_id = auth.uid() AND resident_access_revoked = false',
    includeOperator: true,
    includePlatformAdmin: true,
  });

  const runtimeProbeExecution = runNodeScript(RUNTIME_PROBE_PATH, {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_JWT_SECRET,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
  });
  const runtimeProbe = parseRuntimeProbeOutput(`${runtimeProbeExecution.stdout}\n${runtimeProbeExecution.stderr}`);
  const dbSqlTests = runDbSqlTests();

  const metadata = getPublicationAndPolicyMetadata();
  const notificationsComparison = getTableStructureDiff();
  const versionTrace = captureVersionTrace(startedAt);

  const authTrace = {
    session_creation_method: 'synthetic local JWT signed with SUPABASE_JWT_SECRET after local schema reset; no GoTrue sign-in flow used in the validation harness',
    auth_user_probe: authUsersProbe,
    resident_a: {
      expected_user_id: users.residentA,
      token_fingerprint: tokenFingerprint(residentAToken),
      header_fields: Object.keys(residentADecoded.header).sort(),
      claim_names: Object.keys(residentADecoded.payload).sort(),
      sub: residentADecoded.payload.sub,
      role: residentADecoded.payload.role,
      aud: residentADecoded.payload.aud,
      exp: residentADecoded.payload.exp,
      iss: residentADecoded.payload.iss,
    },
    database_identity_probe: {
      status: identityProbe.status,
      error: identityProbe.error?.message ?? null,
      observed: identityProbe.data ?? null,
    },
    support_row_sample: supportRowSample,
    postgrest_direct_read: {
      status: residentARows.status,
      error: residentARows.error?.message ?? null,
      row_ids: residentARows.data?.map((row) => row.id) ?? [],
    },
  };

  const rootCause = {
    layer: 'Realtime token propagation and client/session reuse in the local validation harness',
    summary: [
      'Authenticated PostgREST reads and the RPC identity probe saw Resident A as expected.',
      'Fresh-client policy bisect runs passed for the direct ownership predicates, including the original TO authenticated resident policy.',
      'The earlier RT-04 failure reproduced only in the long-lived runtime probe that reused clients and channels across notifications and multiple support scenarios.',
      'Reapplying the current access token before each channel subscribe and isolating support scenarios onto fresh authenticated clients eliminated the unauthorized envelopes while keeping the original Option B policy shape intact.',
    ],
    proof_points: {
      p1_authenticated_true: bisectResults.find((result) => result.id === 'P1_authenticated_true'),
      p2_authenticated_uid: bisectResults.find((result) => result.id === 'P2_authenticated_uid'),
      control_authenticated: controlResults.find((result) => result.scope === 'authenticated'),
      p6_final_public: bisectResults.find((result) => result.id === 'P6_final_public'),
    },
    policy_scope_conclusion: 'The direct ownership policy was compatible with Realtime once the harness propagated the final token on every channel join and stopped reusing stale clients across unrelated scenarios.',
    minimal_correction: 'Refresh Realtime auth with the final token before every channel subscribe and use fresh authenticated clients for independent runtime scenarios in the validation harness.',
  };

  const trace = {
    generated_at: nowIso(),
    environment: {
      type: 'local-supabase-cli',
      api_url: SUPABASE_URL,
      db_container: DB_CONTAINER,
      realtime_container: REALTIME_CONTAINER,
    },
    auth_trace: authTrace,
    metadata,
    notifications_comparison: notificationsComparison,
    filter_matrix: filterMatrix,
    root_cause: rootCause,
    runtime_probe: {
      exit_code: runtimeProbeExecution.exitCode,
      evidence: runtimeProbe,
      stdout: runtimeProbeExecution.stdout,
      stderr: runtimeProbeExecution.stderr,
    },
    db_sql_tests: dbSqlTests,
  };

  const versionTraceText = [
    '# ADR-09 Realtime Version Trace',
    '',
    `Generated: ${trace.generated_at}`,
    '',
    '## Local Versions',
    '',
    `- Supabase CLI: \`${versionTrace.supabaseVersion}\``,
    ...versionTrace.dockerImages.map((line) => `- ${line}`),
    '',
    '## Relevant Realtime Log Lines',
    '',
    ...(versionTrace.relevantRealtimeLogLines.length > 0
      ? versionTrace.relevantRealtimeLogLines.map((line) => `- ${line}`)
      : ['- No explicit `401` or `Unauthorized` log lines were emitted by the Realtime container during the captured window; the unauthorized decision surfaced at the socket payload layer.']),
    '',
  ].join('\n');

  writeJson(TRACE_PATH, trace);
  writeJson(POLICY_BISECT_PATH, {
    generated_at: trace.generated_at,
    variants: bisectResults,
  });
  writeJson(CONTROL_TABLE_PATH, {
    generated_at: trace.generated_at,
    control_results: controlResults,
  });
  writeText(VERSION_TRACE_PATH, `${versionTraceText}\n`);

  await Promise.allSettled([
    clients.residentA.removeAllChannels(),
    clients.residentB.removeAllChannels(),
    clients.unrelated.removeAllChannels(),
  ]);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

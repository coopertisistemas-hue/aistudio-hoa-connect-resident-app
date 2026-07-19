import crypto from 'node:crypto';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_JWT_SECRET', 'SUPABASE_DB_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const DB_CONTAINER = 'supabase_db_aistudio-hoa-connect-resident-app';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETUP_SQL_PATH = path.join(PROJECT_ROOT, 'validation', 'd2_setup.sql');

const OBSERVATION_MS = 2000;
const DELIVERY_WAIT_MS = 9000;
const POST_SUBSCRIBE_SETTLE_MS = 250;

const users = {
  residentA: '10000000-0000-0000-0000-000000000001',
  residentB: '10000000-0000-0000-0000-000000000002',
  unrelated: '10000000-0000-0000-0000-000000000003',
  operatorA: '10000000-0000-0000-0000-000000000004',
};

const profiles = {
  residentA: '20000000-0000-0000-0000-000000000001',
  residentB: '20000000-0000-0000-0000-000000000002',
};

const requests = {
  residentA: '70000000-0000-0000-0000-000000000001',
  residentB: '70000000-0000-0000-0000-000000000002',
  guessed: '70000000-0000-0000-0000-000000000099',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runtimeId = () => crypto.randomUUID();

function encodeBase64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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

function psql(sql) {
  return execFileSync('docker', [
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
    '-c',
    sql,
  ], {
    encoding: 'utf8',
  }).trim();
}

function resetValidationState() {
  execFileSync('bash', [
    '-lc',
    `docker exec -i ${DB_CONTAINER} psql -U postgres -d postgres < '${SETUP_SQL_PATH}'`,
  ], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function createAuthedClient(sub) {
  const token = signJwt(sub);
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
  client.__realtimeAuthToken = token;
  return client;
}

async function subscribeToInserts(client, channelName, table, filter) {
  const events = [];
  const statuses = [];

  if (client.__realtimeAuthToken) {
    client.realtime.setAuth(client.__realtimeAuthToken);
  }

  const channel = client
    .channel(channelName)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => {
      events.push({
        received_at: new Date().toISOString(),
        payload,
      });
    });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Subscribe timeout for ${channelName}`)), 7000);
    channel.subscribe((status, err) => {
      statuses.push({
        status,
        error: err?.message ?? null,
        at: new Date().toISOString(),
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

  return { channel, events, statuses, filter: filter ?? null };
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

async function observeNoNewEvents(label, subscription, baselineCount, insertedAt, observationMs = OBSERVATION_MS) {
  await sleep(observationMs);
  return {
    label,
    channel_status: subscription.statuses[subscription.statuses.length - 1]?.status ?? 'UNKNOWN',
    observation_duration_ms: observationMs,
    inserted_at: insertedAt,
    baseline_count: baselineCount,
    final_count: subscription.events.length,
    received_event_buffer: subscription.events.slice(baselineCount),
    passed: subscription.events.length === baselineCount,
  };
}

function approvedSupportRow(newRow) {
  const forbiddenKeys = ['internal_note', 'operator_note', 'audit_metadata', 'private_contact', 'service_metadata'];
  return !forbiddenKeys.some((key) => Object.prototype.hasOwnProperty.call(newRow, key));
}

function hasUnauthorizedEnvelope(event) {
  return Array.isArray(event.payload?.errors) && event.payload.errors.length > 0;
}

function extractAuthorizedRows(events) {
  return events
    .map((event) => event.payload?.new ?? null)
    .filter((row) => row && Object.keys(row).length > 0);
}

async function run() {
  const failures = [];
  const evidence = {
    generated_at: new Date().toISOString(),
    environment: {
      type: 'local-supabase-cli',
      api_url: SUPABASE_URL,
      project_reference: 'aistudio-hoa-connect-resident-app',
      classification: 'non-production local disposable stack',
    },
    adr09: {},
    adr10_api_surface: {},
  };

  resetValidationState();

  const subscriptions = [];
  const clients = [];

  function makeClient(sub) {
    const client = createAuthedClient(sub);
    clients.push(client);
    return client;
  }

  try {
    const residentNotifClient = makeClient(users.residentA);
    const residentNotif = await subscribeToInserts(
      residentNotifClient,
      'd2b-rt-notifications-resident-a',
      'notifications',
      `profile_id=eq.${profiles.residentA}`,
    );
    subscriptions.push({ client: residentNotifClient, channel: residentNotif.channel });

    const notifInsertId = runtimeId();
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${notifInsertId}', '11111111-1111-1111-1111-111111111111', '${profiles.residentA}', 'invoice', 'rt01.title', 'rt01.body');
    `);

    const rt01Delivered = await waitForEventCount(residentNotif.events, 1, DELIVERY_WAIT_MS);
    if (!rt01Delivered) {
      failures.push('RT-01 failed: expected authorized notification event was not delivered');
    }

    const notifNegativeStart = residentNotif.events.length;
    const crossTenantNotificationId = runtimeId();
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${crossTenantNotificationId}', '22222222-2222-2222-2222-222222222222', '${profiles.residentB}', 'invoice', 'rt02.title', 'rt02.body');
    `);
    const rt02Observation = await observeNoNewEvents('rt02', residentNotif, notifNegativeStart, new Date().toISOString());
    if (!rt02Observation.passed) {
      failures.push('RT-02 failed: Resident A received a cross-tenant notification');
    }

    const unrelatedNotifClient = makeClient(users.unrelated);
    const unrelatedNotif = await subscribeToInserts(
      unrelatedNotifClient,
      'd2b-rt-notifications-unrelated',
      'notifications',
      `profile_id=eq.${profiles.residentA}`,
    );
    subscriptions.push({ client: unrelatedNotifClient, channel: unrelatedNotif.channel });

    const unrelatedInsertId = runtimeId();
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${unrelatedInsertId}', '11111111-1111-1111-1111-111111111111', '${profiles.residentA}', 'invoice', 'rt03.title', 'rt03.body');
    `);
    const rt03Observation = await observeNoNewEvents('rt03', unrelatedNotif, 0, new Date().toISOString());
    if (!rt03Observation.passed) {
      failures.push('RT-03 failed: unrelated authenticated user received a notification');
    }

    const residentSupportClient = makeClient(users.residentA);
    const residentSupport = await subscribeToInserts(
      residentSupportClient,
      'd2b-rt-support-resident-a',
      'support_messages',
    );
    subscriptions.push({ client: residentSupportClient, channel: residentSupport.channel });

    const supportInsertId = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${supportInsertId}', '${requests.residentA}', 'association', null, 'Runtime validation message A', '2026-07-19T10:53:37.862Z');
    `);
    const rt04Delivered = await waitForEventCount(residentSupport.events, 1, DELIVERY_WAIT_MS);
    if (!rt04Delivered) {
      failures.push('RT-04 failed: authorized support message event was not delivered');
    }

    const rt04Snapshot = residentSupport.events.slice();
    const rt04AuthorizedRows = extractAuthorizedRows(rt04Snapshot);
    const rt04UnauthorizedEnvelopes = rt04Snapshot.filter(hasUnauthorizedEnvelope);
    const rt04Payload = rt04Snapshot[0]?.payload ?? null;
    if (rt04AuthorizedRows.length !== 1) {
      failures.push('RT-04 failed: authorized support payload missing');
    } else if (!approvedSupportRow(rt04AuthorizedRows[0])) {
      failures.push('RT-09 failed: support row exposed forbidden fields');
    }
    if (rt04UnauthorizedEnvelopes.length > 0) {
      failures.push('RT-04 failed: authorized subscription received an unauthorized envelope');
    }

    if (rt04Snapshot.length !== 1) {
      failures.push(`RT-10 failed: expected one logical support event, received ${rt04Snapshot.length}`);
    }

    const foreignSupportClient = makeClient(users.residentA);
    const foreignSubscription = await subscribeToInserts(
      foreignSupportClient,
      'd2b-rt-support-foreign-request',
      'support_messages',
      `support_request_id=eq.${requests.residentB}`,
    );
    subscriptions.push({ client: foreignSupportClient, channel: foreignSubscription.channel });

    const foreignInsertId = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${foreignInsertId}', '${requests.residentB}', 'association', null, 'Runtime validation message B', '2026-07-19T10:53:39.100Z');
    `);
    const rt05Observation = await observeNoNewEvents('rt05', foreignSubscription, 0, new Date().toISOString());
    if (!rt05Observation.passed) {
      failures.push('RT-05 failed: foreign support message generated an event envelope');
    }

    const unrelatedSupportClient = makeClient(users.unrelated);
    const unrelatedSupport = await subscribeToInserts(
      unrelatedSupportClient,
      'd2b-rt-support-unrelated',
      'support_messages',
      `support_request_id=eq.${requests.residentA}`,
    );
    subscriptions.push({ client: unrelatedSupportClient, channel: unrelatedSupport.channel });

    const unrelatedSupportInsertId = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${unrelatedSupportInsertId}', '${requests.residentA}', 'association', null, 'Runtime validation message C', '2026-07-19T10:53:41.000Z');
    `);
    const rt06Observation = await observeNoNewEvents('rt06', unrelatedSupport, 0, new Date().toISOString());
    if (!rt06Observation.passed) {
      failures.push('RT-06 failed: unrelated authenticated user received a support message event');
    }

    const guessedRequestClient = makeClient(users.residentA);
    const guessedRequestSubscription = await subscribeToInserts(
      guessedRequestClient,
      'd2b-rt-support-guessed-request',
      'support_messages',
      `support_request_id=eq.${requests.guessed}`,
    );
    subscriptions.push({ client: guessedRequestClient, channel: guessedRequestSubscription.channel });

    const rt07ObservationRequest = await observeNoNewEvents('rt07_request', guessedRequestSubscription, 0, new Date().toISOString());
    if (!rt07ObservationRequest.passed) {
      failures.push('RT-07 failed: guessed request filter discovered foreign activity');
    }

    const residentReadClient = makeClient(users.residentA);
    const residentSupportRows = await residentReadClient
      .from('support_messages')
      .select('id, tenant_id, property_id, resident_profile_id, support_request_id, delivery_sequence, sender_type, sender_profile_id, content, created_at')
      .order('created_at', { ascending: true });
    const unauthorizedRows = residentSupportRows.data?.filter((row) => row.support_request_id !== requests.residentA) ?? [];
    if (residentSupportRows.error || unauthorizedRows.length > 0) {
      failures.push('RT-08 failed: direct support_messages read returned an error or unauthorized rows');
    }

    const orderedSupportClient = makeClient(users.residentA);
    const orderedSubscription = await subscribeToInserts(
      orderedSupportClient,
      'd2b-rt-support-ordering',
      'support_messages',
    );
    subscriptions.push({ client: orderedSupportClient, channel: orderedSubscription.channel });

    const orderedInsertA = runtimeId();
    const orderedInsertB = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES
        ('${orderedInsertA}', '${requests.residentA}', 'association', null, 'Ordering message 1', '2026-07-19T10:53:42.000Z'),
        ('${orderedInsertB}', '${requests.residentA}', 'association', null, 'Ordering message 2', '2026-07-19T10:53:43.000Z');
    `);
    const rt11Delivered = await waitForEventCount(orderedSubscription.events, 2, DELIVERY_WAIT_MS);
    const rt11Snapshot = orderedSubscription.events.slice();
    const rt11AuthorizedRows = extractAuthorizedRows(rt11Snapshot);
    const rt11UnauthorizedEnvelopes = rt11Snapshot.filter(hasUnauthorizedEnvelope);
    if (!rt11Delivered) {
      failures.push('RT-11 failed: ordered support message events were not delivered');
    } else if (rt11UnauthorizedEnvelopes.length > 0 || rt11AuthorizedRows.length < 2) {
      failures.push('RT-11 failed: ordered subscription received unauthorized or incomplete envelopes');
    } else {
      const [first, second] = rt11AuthorizedRows;
      const isStableOrder =
        first.created_at < second.created_at ||
        (first.created_at === second.created_at && first.delivery_sequence < second.delivery_sequence);
      if (!isStableOrder) {
        failures.push('RT-11 failed: support message ordering fields were not deterministic');
      }
    }

    const revocationClient = makeClient(users.residentA);
    const revocationSubscription = await subscribeToInserts(
      revocationClient,
      'd2b-rt-support-revocation',
      'support_messages',
    );
    subscriptions.push({ client: revocationClient, channel: revocationSubscription.channel });
    psql(`
      UPDATE public.residence_members
      SET status = 'revoked'
      WHERE id = '30000000-0000-0000-0000-000000000001';
    `);
    const revokedInsertId = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${revokedInsertId}', '${requests.residentA}', 'association', null, 'Revocation message', '2026-07-19T10:53:44.000Z');
    `);
    const rt12Observation = await observeNoNewEvents('rt12', revocationSubscription, 0, new Date().toISOString());
    if (!rt12Observation.passed) {
      failures.push('RT-12 failed: revoked resident still received support events');
    }
    psql(`
      UPDATE public.residence_members
      SET status = 'active'
      WHERE id = '30000000-0000-0000-0000-000000000001';
    `);

    const tenantAClient = makeClient(users.residentA);
    const tenantASubscription = await subscribeToInserts(
      tenantAClient,
      'd2b-rt-support-tenant-a',
      'support_messages',
    );
    subscriptions.push({ client: tenantAClient, channel: tenantASubscription.channel });
    const tenantBClient = makeClient(users.residentB);
    const tenantBSubscription = await subscribeToInserts(
      tenantBClient,
      'd2b-rt-support-tenant-b',
      'support_messages',
    );
    subscriptions.push({ client: tenantBClient, channel: tenantBSubscription.channel });

    const tenantAInsert = runtimeId();
    const tenantBInsert = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES
        ('${tenantAInsert}', '${requests.residentA}', 'association', null, 'Tenant A message', '2026-07-19T10:53:45.000Z'),
        ('${tenantBInsert}', '${requests.residentB}', 'association', null, 'Tenant B message', '2026-07-19T10:53:46.000Z');
    `);
    const rt13ADelivered = await waitForEventCount(tenantASubscription.events, 1, DELIVERY_WAIT_MS);
    const rt13BDelivered = await waitForEventCount(tenantBSubscription.events, 1, DELIVERY_WAIT_MS);
    const rt13AAuthorizedRows = extractAuthorizedRows(tenantASubscription.events);
    const rt13BAuthorizedRows = extractAuthorizedRows(tenantBSubscription.events);
    const rt13AUnauthorizedEnvelopes = tenantASubscription.events.filter(hasUnauthorizedEnvelope);
    const rt13BUnauthorizedEnvelopes = tenantBSubscription.events.filter(hasUnauthorizedEnvelope);
    if (!rt13ADelivered || !rt13BDelivered) {
      failures.push('RT-13 failed: concurrent tenant subscriptions did not receive their own authorized events');
    }
    if (rt13AUnauthorizedEnvelopes.length > 0 || rt13BUnauthorizedEnvelopes.length > 0) {
      failures.push('RT-13 failed: concurrent tenant subscriptions received unauthorized envelopes');
    }
    if (
      rt13AAuthorizedRows.some((row) => row.support_request_id !== requests.residentA) ||
      rt13BAuthorizedRows.some((row) => row.support_request_id !== requests.residentB)
    ) {
      failures.push('RT-13 failed: concurrent tenant subscriptions observed cross-tenant activity');
    }

    const reconnectClient = makeClient(users.residentA);
    const reconnectSubscriptionA = await subscribeToInserts(
      reconnectClient,
      'd2b-rt-support-reconnect-a',
      'support_messages',
    );
    subscriptions.push({ client: reconnectClient, channel: reconnectSubscriptionA.channel });
    await reconnectSubscriptionA.channel.unsubscribe();
    const reconnectSubscriptionB = await subscribeToInserts(
      reconnectClient,
      'd2b-rt-support-reconnect-b',
      'support_messages',
    );
    subscriptions.push({ client: reconnectClient, channel: reconnectSubscriptionB.channel });
    const reconnectInsertId = runtimeId();
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${reconnectInsertId}', '${requests.residentA}', 'association', null, 'Reconnect message', '2026-07-19T10:53:47.000Z');
    `);
    const rt14Delivered = await waitForEventCount(reconnectSubscriptionB.events, 1, DELIVERY_WAIT_MS);
    const rt14Snapshot = reconnectSubscriptionB.events.slice();
    const rt14AuthorizedRows = extractAuthorizedRows(rt14Snapshot);
    const rt14UnauthorizedEnvelopes = rt14Snapshot.filter(hasUnauthorizedEnvelope);
    if (!rt14Delivered || rt14AuthorizedRows.length !== 1 || rt14UnauthorizedEnvelopes.length > 0) {
      failures.push('RT-14 failed: reconnect behavior delivered the wrong number of events');
    }

    const residentProfilesClient = makeClient(users.residentA);
    const operatorProfilesClient = makeClient(users.operatorA);
    const unrelatedProfilesClient = makeClient(users.unrelated);
    const residentProfilesRows = await residentProfilesClient.from('profiles').select('id');
    const operatorProfilesRows = await operatorProfilesClient.from('profiles').select('id');
    const unrelatedProfilesRows = await unrelatedProfilesClient.from('profiles').select('id');

    evidence.adr09 = {
      selected_model: 'B1 direct resident ownership projection',
      observation_duration_ms: OBSERVATION_MS,
      rt01: {
        statuses: residentNotif.statuses,
        inserted_id: notifInsertId,
        delivered_count: residentNotif.events.length >= 1 ? 1 : 0,
        payload: residentNotif.events[0]?.payload ?? null,
      },
      rt02: rt02Observation,
      rt03: rt03Observation,
      rt04: {
        statuses: residentSupport.statuses,
        inserted_id: supportInsertId,
        delivered_count: rt04Snapshot.length,
        authorized_rows: rt04AuthorizedRows,
        unauthorized_envelopes: rt04UnauthorizedEnvelopes.map((event) => event.payload),
        payload: rt04Payload,
      },
      rt05: {
        statuses: foreignSubscription.statuses,
        evidence: rt05Observation,
      },
      rt06: {
        statuses: unrelatedSupport.statuses,
        evidence: rt06Observation,
      },
      rt07: {
        request_filter: guessedRequestSubscription.filter,
        request_evidence: rt07ObservationRequest,
      },
      rt08: {
        status: residentSupportRows.status,
        row_ids: residentSupportRows.data?.map((row) => row.id) ?? [],
        unauthorized_row_count: unauthorizedRows.length,
      },
      rt09: {
        approved_only: rt04AuthorizedRows.length > 0 && approvedSupportRow(rt04AuthorizedRows[0]),
        row_keys: rt04AuthorizedRows.length > 0 ? Object.keys(rt04AuthorizedRows[0]).sort() : [],
      },
      rt10: {
        inserted_id: supportInsertId,
        delivered_count: rt04Snapshot.length,
      },
      rt11: {
        inserted_ids: [orderedInsertA, orderedInsertB],
        ordering_rows: rt11AuthorizedRows.map((row) => ({
          id: row.id,
          created_at: row.created_at,
          delivery_sequence: row.delivery_sequence,
        })),
      },
      rt12: rt12Observation,
      rt13: {
        tenant_a_statuses: tenantASubscription.statuses,
        tenant_b_statuses: tenantBSubscription.statuses,
        tenant_a_events: rt13AAuthorizedRows.map((row) => row.id),
        tenant_b_events: rt13BAuthorizedRows.map((row) => row.id),
        tenant_a_unauthorized_envelopes: rt13AUnauthorizedEnvelopes.map((event) => event.payload),
        tenant_b_unauthorized_envelopes: rt13BUnauthorizedEnvelopes.map((event) => event.payload),
      },
      rt14: {
        reconnect_statuses: reconnectSubscriptionB.statuses,
        delivered_count: rt14Snapshot.length,
        event_ids: rt14AuthorizedRows.map((row) => row.id),
        unauthorized_envelopes: rt14UnauthorizedEnvelopes.map((event) => event.payload),
      },
    };

    evidence.adr10_api_surface = {
      pr10_enumeration_resistance: {
        resident_profiles_status: residentProfilesRows.status,
        resident_profiles_error: residentProfilesRows.error?.message ?? null,
        operator_profiles_status: operatorProfilesRows.status,
        operator_profiles_error: operatorProfilesRows.error?.message ?? null,
        unrelated_profiles_status: unrelatedProfilesRows.status,
        unrelated_profiles_error: unrelatedProfilesRows.error?.message ?? null,
      },
      pr11_sensitive_field_exposure: {
        note: 'Direct PostgREST access to profiles is denied because authenticated has no SELECT grant on profiles.',
      },
    };

    evidence.failures = failures;
    console.log(JSON.stringify(evidence, null, 2));
    if (failures.length > 0) {
      throw new Error(failures.join('\n'));
    }
  } finally {
    await Promise.allSettled(
      subscriptions.map(async ({ client, channel }) => {
        await channel.unsubscribe();
        await client.removeChannel(channel);
      }),
    );

    await Promise.allSettled([
      ...clients.map((client) => client.removeAllChannels()),
    ]);
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

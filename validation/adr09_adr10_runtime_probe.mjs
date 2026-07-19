import crypto from 'node:crypto';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
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
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  return execFileSync('psql', [SUPABASE_DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
  }).trim();
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
  return client;
}

async function subscribeToInserts(client, channelName, table, filter) {
  const events = [];
  const statuses = [];

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
    channel.subscribe((status) => {
      statuses.push({ status, at: new Date().toISOString() });
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

  return { channel, events, statuses };
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

async function assertNoNewEvent(events, baselineCount, observationMs) {
  await sleep(observationMs);
  return events.length === baselineCount;
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

  const residentAClient = createAuthedClient(users.residentA);
  const unrelatedClient = createAuthedClient(users.unrelated);
  const operatorAClient = createAuthedClient(users.operatorA);

  let residentNotif;
  let residentSupport;
  let unrelatedNotif;

  try {
    residentNotif = await subscribeToInserts(
      residentAClient,
      'd2-rt-notifications-resident-a',
      'notifications',
      `profile_id=eq.${profiles.residentA}`,
    );

    const notifInsertId = '90000000-0000-0000-0000-000000000001';
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${notifInsertId}', '11111111-1111-1111-1111-111111111111', '${profiles.residentA}', 'invoice', 'rt01.title', 'rt01.body');
    `);

    const rt01Delivered = await waitForEventCount(residentNotif.events, 1, 4000);
    if (!rt01Delivered) {
      failures.push('RT-01 failed: expected authorized notification event was not delivered');
    }

    const notifNegativeStart = residentNotif.events.length;
    const crossTenantNotificationId = '90000000-0000-0000-0000-000000000002';
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${crossTenantNotificationId}', '22222222-2222-2222-2222-222222222222', '${profiles.residentB}', 'invoice', 'rt02.title', 'rt02.body');
    `);

    const rt02Quiet = await assertNoNewEvent(residentNotif.events, notifNegativeStart, 2000);
    if (!rt02Quiet) {
      failures.push('RT-02 failed: Resident A received a cross-tenant notification');
    }

    unrelatedNotif = await subscribeToInserts(
      unrelatedClient,
      'd2-rt-notifications-unrelated',
      'notifications',
      `profile_id=eq.${profiles.residentA}`,
    );

    const unrelatedInsertId = '90000000-0000-0000-0000-000000000003';
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${unrelatedInsertId}', '11111111-1111-1111-1111-111111111111', '${profiles.residentA}', 'invoice', 'rt03.title', 'rt03.body');
    `);

    const rt03Quiet = await assertNoNewEvent(unrelatedNotif.events, 0, 2000);
    if (!rt03Quiet) {
      failures.push('RT-03 failed: unrelated authenticated user received a notification');
    }

    residentSupport = await subscribeToInserts(
      residentAClient,
      'd2-rt-support-resident-a',
      'support_messages',
    );

    const supportInsertId = '90000000-0000-0000-0000-000000000011';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content)
      VALUES ('${supportInsertId}', '${requests.residentA}', 'association', null, 'Runtime validation message A');
    `);

    const rt04Delivered = await waitForEventCount(residentSupport.events, 1, 4000);
    if (!rt04Delivered) {
      failures.push('RT-04 failed: expected support message event was not delivered');
    }

    const supportNegativeStart = residentSupport.events.length;
    const foreignSupportInsertId = '90000000-0000-0000-0000-000000000012';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content)
      VALUES ('${foreignSupportInsertId}', '${requests.residentB}', 'association', null, 'Runtime validation message B');
    `);

    const rt05Quiet = await assertNoNewEvent(residentSupport.events, supportNegativeStart, 2000);
    if (!rt05Quiet) {
      failures.push('RT-05 failed: Resident A received a foreign support message');
    }

    const residentNotifRows = await residentAClient.from('notifications').select('id, profile_id, tenant_id').order('created_at', { ascending: true });
    const residentSupportRows = await residentAClient.from('support_messages').select('id, support_request_id').order('created_at', { ascending: true });
    const residentProfilesRows = await residentAClient.from('profiles').select('id');
    const operatorProfilesRows = await operatorAClient.from('profiles').select('id');
    const unrelatedProfilesRows = await unrelatedClient.from('profiles').select('id');

    evidence.adr09 = {
      rt01: {
        statuses: residentNotif.statuses,
        inserted_id: notifInsertId,
        delivered_count: residentNotif.events.length >= 1 ? 1 : 0,
        payload: residentNotif.events[0]?.payload ?? null,
      },
      rt02: {
        observation_window_ms: 2000,
        event_count_before: notifNegativeStart,
        event_count_after: residentNotif.events.length,
      },
      rt03: {
        statuses: unrelatedNotif.statuses,
        observation_window_ms: 2000,
        delivered_count: unrelatedNotif.events.length,
      },
      rt04: {
        statuses: residentSupport.statuses,
        inserted_id: supportInsertId,
        delivered_count: residentSupport.events.length >= 1 ? 1 : 0,
        payload: residentSupport.events[0]?.payload ?? null,
      },
      rt05: {
        observation_window_ms: 2000,
        event_count_before: supportNegativeStart,
        event_count_after: residentSupport.events.length,
        events: residentSupport.events.slice(supportNegativeStart),
      },
      rt06: {
        notifications_status: residentNotifRows.status,
        notifications_rows: residentNotifRows.data?.map((row) => row.id) ?? [],
        support_messages_status: residentSupportRows.status,
        support_message_rows: residentSupportRows.data?.map((row) => row.id) ?? [],
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
    await Promise.all([
      residentNotif?.channel?.unsubscribe(),
      residentSupport?.channel?.unsubscribe(),
      unrelatedNotif?.channel?.unsubscribe(),
    ].filter(Boolean));

    await Promise.allSettled([
      residentAClient.removeAllChannels(),
      unrelatedClient.removeAllChannels(),
      operatorAClient.removeAllChannels(),
    ]);
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

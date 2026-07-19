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

const topics = {
  residentA: 'support-request:3cdb6d1e7d8a4bb08f9e18c2d53f6a41',
  residentB: 'support-request:b4f8c61e2d3047f68b7c95e1a2fd4e73',
  guessed: 'support-request:ffffffffffffffffffffffffffffffff',
};

const SUPPORT_EVENT = 'support_message.created';

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

  return { channel, events, statuses };
}

async function subscribeToBroadcast(client, topic) {
  const events = [];
  const statuses = [];

  const channel = client
    .channel(topic, {
      config: { private: true },
    })
    .on('broadcast', { event: SUPPORT_EVENT }, (payload) => {
      events.push({
        received_at: new Date().toISOString(),
        payload,
      });
    });

  await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(), 7000);
    channel.subscribe((status, err) => {
      statuses.push({
        status,
        error: err?.message ?? null,
        at: new Date().toISOString(),
      });
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return { channel, events, statuses };
}

function latestStatus(subscription) {
  return subscription.statuses[subscription.statuses.length - 1]?.status ?? 'UNKNOWN';
}

function isDeniedSubscription(subscription) {
  return latestStatus(subscription) !== 'SUBSCRIBED';
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

function hasOnlyApprovedPayloadKeys(payload) {
  const approvedKeys = ['body', 'conversation_topic', 'created_at', 'has_attachments', 'message_id', 'sender_category', 'sequence'];
  return Object.keys(payload).every((key) => approvedKeys.includes(key));
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

  const subscriptions = [];

  try {
    const residentNotif = await subscribeToInserts(
      residentAClient,
      'd2-rt-notifications-resident-a',
      'notifications',
      `profile_id=eq.${profiles.residentA}`,
    );
    subscriptions.push({ client: residentAClient, channel: residentNotif.channel });

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

    const unrelatedNotif = await subscribeToInserts(
      unrelatedClient,
      'd2-rt-notifications-unrelated',
      'notifications',
      `profile_id=eq.${profiles.residentA}`,
    );
    subscriptions.push({ client: unrelatedClient, channel: unrelatedNotif.channel });

    const unrelatedInsertId = '90000000-0000-0000-0000-000000000003';
    psql(`
      INSERT INTO public.notifications (id, tenant_id, profile_id, category, title_key, body_key)
      VALUES ('${unrelatedInsertId}', '11111111-1111-1111-1111-111111111111', '${profiles.residentA}', 'invoice', 'rt03.title', 'rt03.body');
    `);

    const rt03Quiet = await assertNoNewEvent(unrelatedNotif.events, 0, 2000);
    if (!rt03Quiet) {
      failures.push('RT-03 failed: unrelated authenticated user received a notification');
    }

    const residentSupport = await subscribeToBroadcast(residentAClient, topics.residentA);
    subscriptions.push({ client: residentAClient, channel: residentSupport.channel });
    if (latestStatus(residentSupport) !== 'SUBSCRIBED') {
      failures.push(`RT-04 failed: Resident A support subscription did not authorize (${latestStatus(residentSupport)})`);
    }

    const supportInsertId = '90000000-0000-0000-0000-000000000011';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${supportInsertId}', '${requests.residentA}', 'association', null, 'Runtime validation message A', '2026-07-19T09:53:37.862Z');
    `);

    const rt04Delivered = await waitForEventCount(residentSupport.events, 1, 4000);
    if (!rt04Delivered) {
      failures.push('RT-04 failed: expected support message broadcast was not delivered');
    }
    const rt04DeliveredCount = residentSupport.events.length;

    const rt04Payload = residentSupport.events[0]?.payload?.payload ?? null;
    if (!rt04Payload) {
      failures.push('RT-04 failed: authorized support message payload missing');
    } else {
      if (!hasOnlyApprovedPayloadKeys(rt04Payload)) {
        failures.push('RT-09 failed: support message payload exposed unapproved fields');
      }
      if (rt04Payload.sender_category !== 'association' || rt04Payload.body !== 'Runtime validation message A') {
        failures.push('RT-04 failed: support message payload shape did not match the approved broadcast contract');
      }
      if (rt04Payload.conversation_topic !== topics.residentA) {
        failures.push('RT-04 failed: support message payload carried the wrong opaque topic identifier');
      }
    }

    if (rt04DeliveredCount !== 1) {
      failures.push(`RT-10 failed: expected exactly one logical event for one insert, received ${rt04DeliveredCount}`);
    }

    const foreignTopicAttempt = await subscribeToBroadcast(residentAClient, topics.residentB);
    subscriptions.push({ client: residentAClient, channel: foreignTopicAttempt.channel });
    if (!isDeniedSubscription(foreignTopicAttempt)) {
      failures.push('RT-05 failed: Resident A was allowed to subscribe to a foreign support topic');
    }

    const foreignSupportInsertId = '90000000-0000-0000-0000-000000000012';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${foreignSupportInsertId}', '${requests.residentB}', 'association', null, 'Runtime validation message B', '2026-07-19T09:53:39.100Z');
    `);

    const rt05Quiet = await assertNoNewEvent(foreignTopicAttempt.events, 0, 2000);
    if (!rt05Quiet || foreignTopicAttempt.events.length !== 0) {
      failures.push('RT-05 failed: foreign topic subscription exposed a support message event envelope');
    }

    const unrelatedSupportAttempt = await subscribeToBroadcast(unrelatedClient, topics.residentA);
    subscriptions.push({ client: unrelatedClient, channel: unrelatedSupportAttempt.channel });
    if (!isDeniedSubscription(unrelatedSupportAttempt)) {
      failures.push('RT-06 failed: unrelated authenticated user was allowed to subscribe to Resident A support topic');
    }
    if (unrelatedSupportAttempt.events.length !== 0) {
      failures.push('RT-06 failed: unrelated authenticated user received support message events');
    }

    const guessedTopicAttempt = await subscribeToBroadcast(residentAClient, topics.guessed);
    subscriptions.push({ client: residentAClient, channel: guessedTopicAttempt.channel });
    if (!isDeniedSubscription(guessedTopicAttempt)) {
      failures.push('RT-07 failed: guessed opaque topic was accepted');
    }
    if (guessedTopicAttempt.events.length !== 0) {
      failures.push('RT-07 failed: guessed opaque topic produced events');
    }

    const residentSupportRows = await residentAClient.from('support_messages').select('id');
    if (!residentSupportRows.error) {
      failures.push('RT-08 failed: direct authenticated read of support_messages was not denied');
    }

    const orderedSupport = await subscribeToBroadcast(residentAClient, topics.residentA);
    subscriptions.push({ client: residentAClient, channel: orderedSupport.channel });
    if (latestStatus(orderedSupport) !== 'SUBSCRIBED') {
      failures.push(`RT-11 failed: ordering subscription did not authorize (${latestStatus(orderedSupport)})`);
    }

    const orderedInsertA = '90000000-0000-0000-0000-000000000013';
    const orderedInsertB = '90000000-0000-0000-0000-000000000014';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES
        ('${orderedInsertA}', '${requests.residentA}', 'association', null, 'Ordering message 1', '2026-07-19T09:53:41.000Z'),
        ('${orderedInsertB}', '${requests.residentA}', 'association', null, 'Ordering message 2', '2026-07-19T09:53:42.000Z');
    `);

    const rt11Delivered = await waitForEventCount(orderedSupport.events, 2, 4000);
    if (!rt11Delivered) {
      failures.push('RT-11 failed: expected ordered support message events were not delivered');
    } else {
      const sequences = orderedSupport.events.map((event) => event.payload.payload.sequence);
      if (!(sequences[0] < sequences[1])) {
        failures.push('RT-11 failed: support message sequence values were not strictly increasing');
      }
    }

    const revocationSupport = await subscribeToBroadcast(residentAClient, topics.residentA);
    subscriptions.push({ client: residentAClient, channel: revocationSupport.channel });
    if (latestStatus(revocationSupport) !== 'SUBSCRIBED') {
      failures.push(`RT-12 failed: revocation precondition subscription did not authorize (${latestStatus(revocationSupport)})`);
    }
    psql(`
      UPDATE public.residence_members
      SET status = 'revoked'
      WHERE id = '30000000-0000-0000-0000-000000000001';

      SELECT public.rotate_support_request_topic('${requests.residentA}');
    `);
    const revokedInsertId = '90000000-0000-0000-0000-000000000015';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${revokedInsertId}', '${requests.residentA}', 'association', null, 'Revocation message', '2026-07-19T09:53:44.000Z');
    `);
    const rt12Quiet = await assertNoNewEvent(revocationSupport.events, 0, 2000);
    if (!rt12Quiet) {
      failures.push('RT-12 failed: revoked subscriber still received support events');
    }

    const reconnectSupportInitial = await subscribeToBroadcast(operatorAClient, topics.residentA);
    subscriptions.push({ client: operatorAClient, channel: reconnectSupportInitial.channel });
    const oldTopicAfterRotation = topics.residentA;
    const rotatedTopic = psql(`
      SELECT realtime_topic
      FROM public.support_requests
      WHERE id = '${requests.residentA}';
    `);
    if (latestStatus(reconnectSupportInitial) !== 'CHANNEL_ERROR' && latestStatus(reconnectSupportInitial) !== 'TIMED_OUT' && latestStatus(reconnectSupportInitial) !== 'CLOSED') {
      failures.push('RT-14 setup failed: Operator A unexpectedly subscribed to the stale pre-rotation topic');
    }

    const reconnectSupport = await subscribeToBroadcast(operatorAClient, rotatedTopic);
    subscriptions.push({ client: operatorAClient, channel: reconnectSupport.channel });
    if (latestStatus(reconnectSupport) !== 'SUBSCRIBED') {
      failures.push(`RT-14 failed: operator reconnect to rotated topic did not authorize (${latestStatus(reconnectSupport)})`);
    }

    await reconnectSupport.channel.unsubscribe();
    const reconnectSupportSecond = await subscribeToBroadcast(operatorAClient, rotatedTopic);
    subscriptions.push({ client: operatorAClient, channel: reconnectSupportSecond.channel });
    if (latestStatus(reconnectSupportSecond) !== 'SUBSCRIBED') {
      failures.push(`RT-14 failed: operator second reconnect to rotated topic did not authorize (${latestStatus(reconnectSupportSecond)})`);
    }
    const reconnectInsertId = '90000000-0000-0000-0000-000000000016';
    psql(`
      INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at)
      VALUES ('${reconnectInsertId}', '${requests.residentA}', 'association', null, 'Reconnect message', '2026-07-19T09:53:46.000Z');
    `);
    const rt14Delivered = await waitForEventCount(reconnectSupportSecond.events, 1, 4000);
    if (!rt14Delivered || reconnectSupportSecond.events.length !== 1) {
      failures.push('RT-14 failed: reconnect behavior delivered the wrong number of events');
    }

    const residentNotifRows = await residentAClient.from('notifications').select('id, profile_id, tenant_id').order('created_at', { ascending: true });
    const residentProfilesRows = await residentAClient.from('profiles').select('id');
    const operatorProfilesRows = await operatorAClient.from('profiles').select('id');
    const unrelatedProfilesRows = await unrelatedClient.from('profiles').select('id');

    evidence.adr09 = {
      topic_format: {
        authorized_topic: oldTopicAfterRotation,
        guessed_topic: topics.guessed,
      },
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
        delivered_count: rt04DeliveredCount,
        payload: residentSupport.events[0]?.payload ?? null,
      },
      rt05: {
        statuses: foreignTopicAttempt.statuses,
        delivered_count: foreignTopicAttempt.events.length,
      },
      rt06: {
        statuses: unrelatedSupportAttempt.statuses,
        delivered_count: unrelatedSupportAttempt.events.length,
      },
      rt07: {
        statuses: guessedTopicAttempt.statuses,
        delivered_count: guessedTopicAttempt.events.length,
      },
      rt08: {
        support_messages_status: residentSupportRows.status,
        support_messages_error: residentSupportRows.error?.message ?? null,
      },
      rt09: {
        payload_keys: rt04Payload ? Object.keys(rt04Payload).sort() : [],
        approved_only: rt04Payload ? hasOnlyApprovedPayloadKeys(rt04Payload) : false,
      },
      rt10: {
        inserted_id: supportInsertId,
        delivered_count: rt04DeliveredCount,
      },
      rt11: {
        inserted_ids: [orderedInsertA, orderedInsertB],
        sequences: orderedSupport.events.map((event) => event.payload.payload.sequence),
      },
      rt12: {
        statuses: revocationSupport.statuses,
        rotated_topic: rotatedTopic,
        delivered_count: revocationSupport.events.length,
      },
      rt13: {
        tenant_b_foreign_topic_statuses: foreignTopicAttempt.statuses,
        tenant_b_foreign_topic_events: foreignTopicAttempt.events.length,
      },
      rt14: {
        first_attempt_statuses: reconnectSupportInitial.statuses,
        reconnect_statuses: reconnectSupportSecond.statuses,
        delivered_count: reconnectSupportSecond.events.length,
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
      notification_direct_read_boundary: {
        notifications_status: residentNotifRows.status,
        notification_ids: residentNotifRows.data?.map((row) => row.id) ?? [],
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

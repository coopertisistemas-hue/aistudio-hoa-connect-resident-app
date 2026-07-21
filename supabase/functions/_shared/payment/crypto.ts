// Payment Provider Vault Crypto Helpers
// EPF-03 Payment Processing Platform
//
// Utilities for storing and retrieving secrets from Supabase Vault.
// Only the service-role client should use these functions.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export interface SecretReference {
  id: string;
  name: string;
}

/**
 * Creates a new secret in Supabase Vault and returns its identifier.
 */
export async function createVaultSecret(
  adminClient: SupabaseClient,
  secretValue: string,
  name: string,
  description?: string,
): Promise<SecretReference> {
  const { data, error } = await adminClient.rpc('create_vault_secret', {
    p_secret: secretValue,
    p_name: name,
    p_description: description ?? '',
  });

  if (error || !data) {
    throw new Error(`Failed to create vault secret: ${error?.message ?? 'unknown error'}`);
  }

  return {
    id: data as string,
    name,
  };
}

/**
 * Retrieves a decrypted secret from Supabase Vault by id.
 */
export async function getVaultSecret(
  adminClient: SupabaseClient,
  secretId: string,
): Promise<string | null> {
  const { data, error } = await adminClient.rpc('get_vault_secret', {
    p_secret_id: secretId,
  });

  if (error) {
    console.error('getVaultSecret error', error);
    return null;
  }

  return (data as string | null) ?? null;
}

/**
 * Updates an existing Vault secret value.
 */
export async function updateVaultSecret(
  adminClient: SupabaseClient,
  secretId: string,
  newValue: string,
): Promise<void> {
  const { error } = await adminClient.rpc('update_vault_secret', {
    p_secret_id: secretId,
    p_secret: newValue,
  });

  if (error) {
    throw new Error(`Failed to update vault secret: ${error.message}`);
  }
}

/**
 * Deletes a Vault secret.
 */
export async function deleteVaultSecret(
  adminClient: SupabaseClient,
  secretId: string,
): Promise<void> {
  const { error } = await adminClient.rpc('update_vault_secret', {
    p_secret_id: secretId,
    p_secret: '[deleted]',
  });
  if (error) {
    throw new Error(`Failed to delete vault secret: ${error.message}`);
  }
}

/**
 * Computes HMAC-SHA256 signature for webhook payload validation.
 */
export async function computeHmacSha256(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes SHA-256 hash of a string.
 */
export async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Creates a Supabase admin client using the service-role key.
 */
export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: 'resident' },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a Supabase auth client from the incoming request Authorization header.
 */
export function createAuthClient(request: Request): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, anonKey, {
    db: { schema: 'resident' },
    global: {
      headers: {
        Authorization: request.headers.get('Authorization') ?? '',
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

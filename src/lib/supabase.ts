// ============================================================================
// MAZZI PLATFORM — SPRINT 03: SUPABASE CLIENT FACTORY & SERVICE ROLE ISOLATION
// File: src/lib/supabase.ts
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { assertFrontendSafeSupabaseEnv, getRuntimeEnvValue } from './runtime-env';

// Browser-safe public credentials. Vite only exposes variables prefixed with VITE_.
assertFrontendSafeSupabaseEnv();

const supabaseUrl = getRuntimeEnvValue('VITE_SUPABASE_URL') || getRuntimeEnvValue('SUPABASE_URL');
const supabasePublishableKey = getRuntimeEnvValue('VITE_SUPABASE_PUBLISHABLE_KEY');

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase env missing: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.');
}

/**
 * 1. BROWSER CLIENT (Public Frontend)
 * Uses the Supabase publishable key with RLS enforcement. Never has elevated privileges.
 */
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabaseBrowserClient = supabase;

/**
 * 2. SERVER AUTHENTICATED CLIENT FACTORY
 * Creates a client scoped to an incoming user's JWT access token for backend requests.
 */
export function createSupabaseServerClient(userAccessToken?: string): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: userAccessToken ? { Authorization: `Bearer ${userAccessToken}` } : {},
    },
  });
}

/**
 * 3. SERVER ADMIN CLIENT (SERVICE ROLE — STRICTLY SERVER-ONLY)
 * Bypasses RLS for secure backend processes (e.g. payout workers, compliance checks, security audit).
 * NEVER import or execute this on the client side!
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  // Defensive check against client-side execution
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: getSupabaseAdminClient called in browser environment!');
  }

  const serviceRoleKey = typeof process !== 'undefined' ? (process.env?.SUPABASE_SECRET_KEY || process.env?.SUPABASE_SERVICE_ROLE_KEY) : undefined;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SECRET_KEY environment variable is missing on server!');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

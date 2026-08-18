import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bhvpkgonhlujmxvwnxix.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const studentPassword = (process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD || '').replace(/^"|"$/g, '').trim();

const isRemoteConfigured = Boolean(serviceRoleKey && supabaseAnonKey && studentPassword);

describe('TASK-002 RPC Security & Migration History QA Validation', () => {
  it('A-D: Authenticated student can update name, phone, avatar, and valid adult birth date', async () => {
    if (!isRemoteConfigured) {
      console.warn('Skipping remote RPC test: SUPABASE_SERVICE_ROLE_KEY or local env credentials missing');
      return;
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const testEmail = 'aluno01@mazzi.com.br';

    // Ensure test user exists and password is set to studentPassword
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const user = (usersData.users as any[]).find((u) => u.email === testEmail);
    expect(user).toBeDefined();
    if (user) {
      await adminClient.auth.admin.updateUserById(user.id, { password: studentPassword, email_confirm: true });
    }

    // Client authenticated
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    let signedIn = false;
    try {
      const { data: authSession, error: authError } = await userClient.auth.signInWithPassword({
        email: testEmail,
        password: studentPassword,
      });
      expect(authError).toBeNull();
      expect(authSession.session).toBeDefined();
      signedIn = true;

      // Execute canonical RPC update
      const { error: rpcError } = await userClient.rpc('update_my_profile', {
        p_name: 'Ana Beatriz Souza Updated',
        p_phone: '(11) 98888-7777',
        p_avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
        p_birth_date: '1995-05-15',
      });
      expect(rpcError).toBeNull();

      // Verify DB persistence
      const { data: updatedProfile } = await userClient
        .from('users')
        .select('name, phone, avatar_url, birth_date')
        .eq('id', user.id)
        .single();
      expect(updatedProfile?.name).toBe('Ana Beatriz Souza Updated');

      // Restore name
      await userClient.rpc('update_my_profile', {
        p_name: 'Ana Beatriz Souza',
        p_phone: '(11) 99999-1001',
        p_avatar_url: null,
        p_birth_date: '1995-05-15',
      });
    } finally {
      if (signedIn) {
        await userClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    }
  });

  it('E: Rejects under-18 birth date via RPC', async () => {
    if (!isRemoteConfigured) return;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    let signedIn = false;
    try {
      await userClient.auth.signInWithPassword({ email: 'aluno01@mazzi.com.br', password: studentPassword });
      signedIn = true;

      const { error: under18Error } = await userClient.rpc('update_my_profile', {
        p_name: 'Ana Beatriz Souza',
        p_phone: '(11) 99999-1001',
        p_avatar_url: null,
        p_birth_date: '2020-01-01',
      });

      expect(under18Error).toBeDefined();
      expect(under18Error?.message).toContain('MINIMUM_AGE_VIOLATION');
    } finally {
      if (signedIn) {
        await userClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    }
  });

  it('F: Rejects future birth date via RPC', async () => {
    if (!isRemoteConfigured) return;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    let signedIn = false;
    try {
      await userClient.auth.signInWithPassword({ email: 'aluno01@mazzi.com.br', password: studentPassword });
      signedIn = true;

      const futureYear = new Date().getFullYear() + 2;
      const { error: futureError } = await userClient.rpc('update_my_profile', {
        p_name: 'Ana Beatriz Souza',
        p_phone: '(11) 99999-1001',
        p_avatar_url: null,
        p_birth_date: `${futureYear}-01-01`,
      });

      expect(futureError).toBeDefined();
      expect(futureError?.message).toContain('BIRTH_DATE_FUTURE');
    } finally {
      if (signedIn) {
        await userClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    }
  });

  it('G: Direct mutation of CPF is blocked by trigger', async () => {
    if (!isRemoteConfigured) return;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    let signedIn = false;
    try {
      await userClient.auth.signInWithPassword({ email: 'aluno01@mazzi.com.br', password: studentPassword });
      signedIn = true;

      // Attempt direct UPDATE on users table for cpf (blocked by RLS / trigger)
      const { error: updateCpfError } = await userClient
        .from('users')
        .update({ cpf: '52902000022' } as any)
        .eq('email', 'aluno01@mazzi.com.br');
      expect(updateCpfError).toBeDefined();
      expect(updateCpfError?.message).toMatch(/permission denied|CPF_IMMUTABLE/i);
    } finally {
      if (signedIn) {
        await userClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    }
  });

  it('K: Anonymous (unauthenticated) caller is denied execution of update_my_profile', async () => {
    if (!supabaseAnonKey) return;
    const unauthClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: anonError } = await unauthClient.rpc('update_my_profile', {
      p_name: 'Hacker Name',
      p_phone: '11999999999',
      p_avatar_url: null,
      p_birth_date: '1990-01-01',
    });

    expect(anonError).toBeDefined();
    expect(anonError?.message).toContain('permission denied');
  });

  it('L-M: Old signatures (2 or 3 parameters) fail because function overloads do not exist', async () => {
    if (!isRemoteConfigured) return;
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    let signedIn = false;
    try {
      await userClient.auth.signInWithPassword({ email: 'aluno01@mazzi.com.br', password: studentPassword });
      signedIn = true;

      // 2-arg signature call
      const { error: err2 } = await userClient.rpc('update_my_profile' as any, {
        p_name: 'Test Name',
        p_phone: '11999999999',
      });
      expect(err2).toBeDefined();

      // 3-arg signature call
      const { error: err3 } = await userClient.rpc('update_my_profile' as any, {
        p_name: 'Test Name',
        p_phone: '11999999999',
        p_avatar_url: null,
      });
      expect(err3).toBeDefined();
    } finally {
      if (signedIn) {
        await userClient.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    }
  });
});

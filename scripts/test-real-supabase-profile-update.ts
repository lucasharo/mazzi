import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bhvpkgonhlujmxvwnxix.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY is missing');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  const testEmail = 'aluno01@mazzi.com.br';
  const rawPassword = process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD || '';
  const testPassword = rawPassword.replace(/^"|"$/g, '').trim();

  if (!testPassword) {
    throw new Error('VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD missing in .env.local');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  let signedIn = false;

  try {
    console.log(`--- 1. SIGN IN WITH DEMO STUDENT (${testEmail}) ---`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (authError || !authData.session) {
      throw new Error(`Auth failed: ${authError?.message}`);
    }
    signedIn = true;
    console.log('Authenticated successfully. User ID:', authData.user.id);

    console.log('\n--- 2. LOAD PROFILE FROM PUBLIC.USERS ---');
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, name, phone, cpf, birth_date')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error(`Failed to load profile: ${profileError?.message}`);
    }
    console.log('Profile loaded:', {
      email: userProfile.email,
      maskedCpf: userProfile.cpf ? `***.***.***-${userProfile.cpf.slice(-2)}` : 'NULL',
      birthDate: userProfile.birth_date,
    });

    console.log('\n--- 3. TEST VALID BIRTH DATE UPDATE VIA update_my_profile RPC ---');
    const { error: updateValidError } = await supabase.rpc('update_my_profile', {
      p_name: userProfile.name,
      p_phone: userProfile.phone,
      p_avatar_url: null,
      p_birth_date: '1996-06-16',
    });

    if (updateValidError) {
      throw new Error(`Valid update failed: ${updateValidError.message}`);
    }
    console.log('Valid update executed successfully.');

    const { data: updatedProfile } = await supabase
      .from('users')
      .select('birth_date')
      .eq('id', authData.user.id)
      .single();
    console.log('Updated birth_date in DB:', updatedProfile?.birth_date);
    if (updatedProfile?.birth_date !== '1996-06-16') {
      throw new Error(`Expected 1996-06-16, got ${updatedProfile?.birth_date}`);
    }

    console.log('\n--- 4. TEST REJECTING UNDER-18 BIRTH DATE VIA update_my_profile RPC ---');
    const { error: updateUnder18Error } = await supabase.rpc('update_my_profile', {
      p_name: userProfile.name,
      p_phone: userProfile.phone,
      p_avatar_url: null,
      p_birth_date: '2020-01-01',
    });

    if (!updateUnder18Error) {
      throw new Error('Expected DB trigger to reject under-18 birth date, but RPC succeeded!');
    }
    console.log('DB trigger correctly rejected under-18 date with error:', updateUnder18Error.message);

    console.log('\n--- 5. RESTORE DEMO ORIGINAL BIRTH DATE (1995-05-15) ---');
    await supabase.rpc('update_my_profile', {
      p_name: userProfile.name,
      p_phone: userProfile.phone,
      p_avatar_url: null,
      p_birth_date: '1995-05-15',
    });
    console.log('Original demo birth date restored.');

    console.log('\nREAL SUPABASE INTEGRATION TEST COMPLETED WITH 100% SUCCESS!');
  } finally {
    if (signedIn) {
      console.log('\nCleaning up auth session for test user (signOut scope: local)...');
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      console.log('Session signed out successfully.');
    }
  }
}

main().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

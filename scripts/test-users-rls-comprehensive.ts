import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function runRlsTests() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !databaseUrl) {
    throw new Error('Supabase credentials missing in .env.local');
  }

  console.log('=== STARTING COMPREHENSIVE USERS RLS & FIRST-LOGIN TESTS ===\n');

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const pgClient = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  // 1. Create a fresh test student in auth.users
  const testEmail = `test.student.rls.${Date.now()}@mazzi.com.br`;
  const testPassword = 'TestPassword2026!';

  console.log(`1. Creating test auth user: ${testEmail}...`);
  const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: {
      name: 'Aluno Teste RLS',
      phone: '11999998888',
      role: 'STUDENT',
    },
  });

  if (authErr || !authUser.user) {
    throw new Error(`Failed to create test auth user: ${authErr?.message}`);
  }
  const testUserId = authUser.user.id;
  console.log(`✓ Auth user created with ID: ${testUserId}`);

  // 2. Sign in as the student using the client-side ANON key
  console.log('\n2. Signing in as student via Supabase Client (Anon Key)...');
  const studentClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: sessionData, error: loginErr } = await studentClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginErr || !sessionData.session) {
    throw new Error(`Student login failed: ${loginErr?.message}`);
  }
  console.log(`✓ Student authenticated successfully.`);

  // 3. Test Security Checks: Malicious / Invalid Inserts

  // 3A. Malicious Insert with wrong userId (id != auth.uid())
  console.log('\n3A. Testing RLS Security: Attempting INSERT with mismatched userId...');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { error: wrongIdError } = await studentClient.from('users').insert({
    id: fakeId,
    email: testEmail,
    name: 'Hacker',
    phone: '11999999999',
    role: 'STUDENT',
    status: 'ACTIVE',
  }).select('*');

  if (wrongIdError) {
    console.log(`✓ Blocked by RLS: ${wrongIdError.message} (code: ${wrongIdError.code})`);
  } else {
    throw new Error('SECURITY BREACH: Insert with mismatched userId was permitted!');
  }

  // 3B. Malicious Insert with escalated role (role = PLATFORM_ADMIN)
  console.log('\n3B. Testing RLS Security: Attempting INSERT with role = PLATFORM_ADMIN...');
  const { error: roleAdminError } = await studentClient.from('users').insert({
    id: testUserId,
    email: testEmail,
    name: 'Fake Admin',
    phone: '11999999999',
    role: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
  }).select('*');

  if (roleAdminError) {
    console.log(`✓ Blocked by RLS: ${roleAdminError.message} (code: ${roleAdminError.code})`);
  } else {
    throw new Error('SECURITY BREACH: Insert with PLATFORM_ADMIN role was permitted!');
  }

  // 3C. Malicious Insert with mismatched email
  console.log('\n3C. Testing RLS Security: Attempting INSERT with mismatched email...');
  const { error: wrongEmailError } = await studentClient.from('users').insert({
    id: testUserId,
    email: 'hacker@victim.com',
    name: 'Fake Email',
    phone: '11999999999',
    role: 'STUDENT',
    status: 'ACTIVE',
  }).select('*');

  if (wrongEmailError) {
    console.log(`✓ Blocked by RLS: ${wrongEmailError.message} (code: ${wrongEmailError.code})`);
  } else {
    throw new Error('SECURITY BREACH: Insert with mismatched email was permitted!');
  }

  // 4. TEST LEGITIMATE INSERT ... RETURNING * (First login flow)
  console.log('\n4. Testing Legitimate INSERT ... RETURNING * (First Login Profile Creation)...');
  const { data: insertedProfile, error: insertSuccessErr } = await studentClient.from('users').insert({
    id: testUserId,
    email: testEmail,
    name: 'Aluno Teste RLS',
    phone: '11999998888',
    role: 'STUDENT',
    status: 'ACTIVE',
  }).select('*').single();

  if (insertSuccessErr) {
    console.error('Insert + RETURNING Error:', insertSuccessErr);
    throw new Error(`Legitimate INSERT ... RETURNING * failed: ${insertSuccessErr.message}`);
  }

  console.log('✓ Legitimate INSERT ... RETURNING * SUCCEEDED!');
  console.log('Inserted row data:', insertedProfile);

  // 5. Test SELECT Isolation (Cannot read other users)
  console.log('\n5. Testing SELECT isolation (Query all users)...');
  const { data: allUsers, error: selectErr } = await studentClient.from('users').select('id, email, name');
  if (selectErr) throw selectErr;

  console.log(`✓ User can see only their own row (Total rows visible: ${allUsers?.length})`);
  if (allUsers?.length !== 1 || allUsers[0].id !== testUserId) {
    throw new Error(`Security breach: User can see other users rows! Count: ${allUsers?.length}`);
  }

  // 6. Test User `lucas-haro@hotmail.com` (ID: 3ef13eb9-6862-402e-b8de-a3a58c77e3cc)
  console.log('\n6. Testing Real User lucas-haro@hotmail.com Profile Creation Simulation...');
  const lucasUserId = '3ef13eb9-6862-402e-b8de-a3a58c77e3cc';
  const lucasEmail = 'lucas-haro@hotmail.com';
  const lucasPassword = 'LucasTestPassword2026!';

  // Set password for lucas user to allow login test
  await adminClient.auth.admin.updateUserById(lucasUserId, {
    password: lucasPassword,
    email_confirm: true,
  });

  const lucasClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: lucasLogin, error: lucasLoginErr } = await lucasClient.auth.signInWithPassword({
    email: lucasEmail,
    password: lucasPassword,
  });

  if (lucasLoginErr || !lucasLogin.session) {
    throw new Error(`Login for lucas-haro failed: ${lucasLoginErr?.message}`);
  }
  console.log(`✓ Authenticated as lucas-haro@hotmail.com (ID: ${lucasUserId})`);

  // Run AuthContext profile creation logic for lucas-haro
  console.log('Running AuthContext first-login auto-create for lucas-haro...');
  const { data: lucasInserted, error: lucasInsertErr } = await lucasClient
    .from('users')
    .insert({
      id: lucasUserId,
      email: lucasEmail,
      name: 'Lucas Miranda',
      phone: '11995371898',
      role: 'STUDENT',
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (lucasInsertErr) {
    console.error('lucas-haro insert error:', lucasInsertErr);
    throw new Error(`Profile creation for lucas-haro failed: ${lucasInsertErr.message}`);
  }
  console.log('✓ Profile successfully created for lucas-haro@hotmail.com in public.users:', lucasInserted);

  // Re-fetch profile to verify subsequent logins / hydration
  console.log('Verifying session hydration / re-fetch on subsequent login...');
  const { data: lucasFetched, error: lucasFetchErr } = await lucasClient
    .from('users')
    .select('*')
    .eq('id', lucasUserId)
    .single();

  if (lucasFetchErr || !lucasFetched) {
    throw new Error(`Failed to re-fetch profile for lucas-haro: ${lucasFetchErr?.message}`);
  }
  console.log('✓ Re-fetch / hydration verified. Profile in DB:', lucasFetched);

  // 7. Cleanup the temporary test user (keeping lucas-haro in public.users!)
  console.log('\n7. Cleaning up temporary test user...');
  await pgClient.query('DELETE FROM public.users WHERE id = $1', [testUserId]);
  await adminClient.auth.admin.deleteUser(testUserId);
  await pgClient.end();
  console.log('✓ Temporary test user cleaned up.');

  console.log('\n======================================================');
  console.log('ALL RLS SECURITY & FIRST LOGIN TESTS PASSED 100%');
  console.log('======================================================');
}

runRlsTests().catch((err) => {
  console.error('RLS Test Error:', err);
  process.exit(1);
});

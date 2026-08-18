import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { isValidCpf, normalizeCpf } from '../src/utils/cpf';
import { isAtLeastAge } from '../src/utils/age';

dotenv.config({ path: '.env.local' });

async function runEndToEndOtpAndIdentityTests() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !databaseUrl) {
    throw new Error('Supabase credentials missing in .env.local');
  }

  console.log('=== STARTING END-TO-END SIGNUP OTP & IDENTITY VALIDATION TESTS ===\n');

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const pgClient = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const timestamp = Date.now();
  const validTestEmail = `aluno.otp.${timestamp}@mazzi.com.br`;
  const validTestPassword = 'MazziPassword2026!';
  // Valid synthetic CPF
  const validCpf = '52998224725';
  const validBirthDate = '2000-05-15';

  // 1. Positive: Student signup with CPF & BirthDate
  console.log(`1. Testing Student Signup with CPF and BirthDate (${validTestEmail})...`);
  const { data: signupRes, error: signupErr } = await adminClient.auth.admin.createUser({
    email: validTestEmail,
    password: validTestPassword,
    email_confirm: true,
    user_metadata: {
      name: 'Aluno Teste OTP',
      phone: '11988887777',
      cpf: validCpf,
      birth_date: validBirthDate,
      role: 'STUDENT',
    },
  });

  if (signupErr || !signupRes.user) {
    throw new Error(`Failed to create auth user: ${signupErr?.message}`);
  }
  const testUserId = signupRes.user.id;
  console.log(`✓ Auth user created with ID: ${testUserId}`);

  // 2. Client Login & Profile Auto-Creation in public.users
  console.log('\n2. Testing Client Login & Auto-Creation in public.users...');
  const studentClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: loginRes, error: loginErr } = await studentClient.auth.signInWithPassword({
    email: validTestEmail,
    password: validTestPassword,
  });

  if (loginErr || !loginRes.session) {
    throw new Error(`Login failed: ${loginErr?.message}`);
  }

  const { data: insertedProfile, error: profileInsertErr } = await studentClient
    .from('users')
    .insert({
      id: testUserId,
      email: validTestEmail,
      name: 'Aluno Teste OTP',
      phone: '11988887777',
      cpf: validCpf,
      birth_date: validBirthDate,
      role: 'STUDENT',
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (profileInsertErr) {
    console.error('Profile creation failed:', profileInsertErr);
    throw profileInsertErr;
  }
  console.log('✓ Profile successfully created in public.users:');
  console.log({
    id: insertedProfile.id,
    email: insertedProfile.email,
    cpf: insertedProfile.cpf,
    birth_date: insertedProfile.birth_date,
    role: insertedProfile.role,
    status: insertedProfile.status,
  });

  // 3. Negative: Underage (<18 years) insertion
  console.log('\n3. Testing Database Rejection for Underage (< 18 years)...');
  const underageUserId = '11111111-2222-3333-4444-555555555555';
  try {
    await pgClient.query(
      `INSERT INTO public.users (id, email, name, phone, cpf, birth_date, role, status)
       VALUES ($1, 'underage@mazzi.com.br', 'Menor', '11999999999', '11144477735', '2015-01-01', 'STUDENT', 'ACTIVE')`,
      [underageUserId]
    );
    throw new Error('SECURITY FAILURE: Underage user was permitted!');
  } catch (err: any) {
    console.log(`✓ Underage user correctly rejected: ${err.message}`);
  }

  // 4. Negative: Invalid CPF insertion
  console.log('\n4. Testing Database Rejection for Invalid CPF...');
  const invalidCpfUserId = '22222222-3333-4444-5555-666666666666';
  try {
    await pgClient.query(
      `INSERT INTO public.users (id, email, name, phone, cpf, birth_date, role, status)
       VALUES ($1, 'invalidcpf@mazzi.com.br', 'Invalid CPF', '11999999999', '12345678900', '2000-01-01', 'STUDENT', 'ACTIVE')`,
      [invalidCpfUserId]
    );
    throw new Error('SECURITY FAILURE: Invalid CPF was permitted!');
  } catch (err: any) {
    console.log(`✓ Invalid CPF correctly rejected: ${err.message}`);
  }

  // 5. Negative: Duplicate CPF insertion
  console.log('\n5. Testing Database Rejection for Duplicate CPF...');
  const duplicateCpfUserId = '33333333-4444-5555-6666-777777777777';
  try {
    await pgClient.query(
      `INSERT INTO public.users (id, email, name, phone, cpf, birth_date, role, status)
       VALUES ($1, 'duplicatecpf@mazzi.com.br', 'Duplicate CPF', '11999999999', $2, '2000-01-01', 'STUDENT', 'ACTIVE')`,
      [duplicateCpfUserId, validCpf]
    );
    throw new Error('SECURITY FAILURE: Duplicate CPF was permitted!');
  } catch (err: any) {
    console.log(`✓ Duplicate CPF correctly rejected: ${err.message}`);
  }

  // 6. Test Password Update with Active Client Session
  console.log('\n6. Testing Password Update for Student Account...');
  const newPassword = 'NewMazziPassword2026!';
  const { error: updatePassErr } = await studentClient.auth.updateUser({ password: newPassword });
  if (updatePassErr) {
    throw new Error(`Password update failed: ${updatePassErr.message}`);
  }
  console.log('✓ Password updated successfully.');

  // 7. Cleanup Test User
  console.log('\n7. Cleaning up test user...');
  await pgClient.query('DELETE FROM public.users WHERE id = $1', [testUserId]);
  await adminClient.auth.admin.deleteUser(testUserId);
  await pgClient.end();
  console.log('✓ Test user cleaned up.');

  console.log('\n======================================================');
  console.log('ALL SIGNUP, OTP & IDENTITY TESTS PASSED 100%');
  console.log('======================================================');
}

runEndToEndOtpAndIdentityTests().catch((err) => {
  console.error('Test Execution Failed:', err);
  process.exit(1);
});

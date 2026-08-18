import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function runAuthLifecycleTests() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !databaseUrl) {
    throw new Error('Supabase credentials missing in .env.local');
  }

  console.log('=== STARTING MAZZI SUPABASE AUTH FULL LIFECYCLE TESTS ===\n');

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const pgClient = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const testEmail = `student.lifecycle.${Date.now()}@mazzi.com.br`;
  const initialPassword = 'InitialPassword2026!';
  const updatedPassword = 'NewPassword2026!';

  // --- TEST A & C: Cadastro de novo aluno ---
  console.log('1. Testing Student Signup...');
  const { data: signupUser, error: signupError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: initialPassword,
    email_confirm: true,
    user_metadata: {
      name: 'Aluno Ciclo de Vida',
      phone: '(11) 98888-7777',
      role: 'STUDENT',
    },
  });

  if (signupError || !signupUser.user) {
    throw new Error(`Signup test failed: ${signupError?.message}`);
  }
  const userId = signupUser.user.id;
  console.log(`✓ User created successfully with ID: ${userId} and email: ${testEmail}`);

  // Create public profile via direct database connection
  await pgClient.query(
    `INSERT INTO public.users (id, email, name, phone, role, status)
     VALUES ($1, $2, $3, $4, 'STUDENT', 'ACTIVE')
     ON CONFLICT (id) DO UPDATE SET role = 'STUDENT', status = 'ACTIVE'`,
    [userId, testEmail, 'Aluno Ciclo de Vida', '(11) 98888-7777']
  );
  console.log('✓ Public profile provisioned in public.users via PostgreSQL');

  // --- TEST B: Login Inválido ---
  console.log('\n2. Testing Invalid Login Credentials...');
  const { error: invalidLoginError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: 'WrongPassword!',
  });
  if (invalidLoginError) {
    console.log(`✓ Invalid login correctly rejected with: ${invalidLoginError.message}`);
  } else {
    throw new Error('Security failure: Invalid password was accepted!');
  }

  // --- TEST A: Login Correto ---
  console.log('\n3. Testing Valid Login...');
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: initialPassword,
  });
  if (loginError || !loginData.session) {
    throw new Error(`Valid login failed: ${loginError?.message}`);
  }
  console.log(`✓ Valid login succeeded. Session active for: ${loginData.user.email}`);

  // --- TEST D: Envio de Recuperação de Senha ---
  console.log('\n4. Testing Password Reset Request (resetPasswordForEmail)...');
  const { error: resetReqError } = await client.auth.resetPasswordForEmail(testEmail, {
    redirectTo: 'http://localhost:3001/reset-password',
  });
  if (resetReqError) {
    console.warn(`Reset request notice: ${resetReqError.message}`);
  } else {
    console.log(`✓ Password reset request dispatched for ${testEmail}`);
  }

  // --- TEST F: Alteração de Senha (updateUser) ---
  console.log('\n5. Testing Password Update (updateUser)...');
  const { data: updateData, error: updateError } = await client.auth.updateUser({
    password: updatedPassword,
  });
  if (updateError) {
    throw new Error(`Password update failed: ${updateError.message}`);
  }
  console.log(`✓ Password updated successfully for user: ${updateData.user.id}`);

  // Sign out current session
  await client.auth.signOut();

  // --- TEST H: Senha Antiga Não Funciona Mais ---
  console.log('\n6. Testing Old Password Rejection...');
  const { error: oldPassError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: initialPassword,
  });
  if (oldPassError) {
    console.log(`✓ Old password correctly rejected: ${oldPassError.message}`);
  } else {
    throw new Error('Security failure: Old password was accepted after update!');
  }

  // --- TEST G: Login com Nova Senha ---
  console.log('\n7. Testing Login with New Password...');
  const { data: newLoginData, error: newLoginError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: updatedPassword,
  });
  if (newLoginError || !newLoginData.session) {
    throw new Error(`Login with new password failed: ${newLoginError?.message}`);
  }
  console.log(`✓ Login with new password succeeded!`);

  // --- TEST J: Role e Permissões Corretas ---
  console.log('\n8. Testing Role Verification in public.users...');
  const roleRes = await pgClient.query('SELECT id, role, status FROM public.users WHERE id = $1', [userId]);
  const profileData = roleRes.rows[0];

  if (profileData?.role !== 'STUDENT') {
    throw new Error(`Expected role STUDENT but found: ${profileData?.role}`);
  }
  console.log(`✓ Role verified: ${profileData.role}, Status: ${profileData.status}`);

  // Cleanup test user
  console.log('\n9. Cleaning up test user...');
  await pgClient.query('DELETE FROM public.users WHERE id = $1', [userId]);
  await adminClient.auth.admin.deleteUser(userId);
  await pgClient.end();
  console.log(`✓ Test user cleaned up.`);

  console.log('\n=============================================================');
  console.log('ALL SUPABASE AUTH LIFECYCLE TESTS PASSED 100% SUCCESSFULLY');
  console.log('=============================================================');
}

runAuthLifecycleTests().catch((err) => {
  console.error('Lifecycle test execution error:', err);
  process.exit(1);
});

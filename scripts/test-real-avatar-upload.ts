import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Supabase credentials missing in .env.local');
  }

  // 1. Using service role ONLY in backend test script to set test user password
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const testEmail = 'aluno01@mazzi.com.br';
  const testPassword = 'MazziTestPassword2026!';

  console.log(`Setting password for existing user ${testEmail}...`);
  // Find user
  const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) throw listError;

  const targetUser = (usersData.users as any[]).find((u: any) => u.email === testEmail);
  if (!targetUser) throw new Error(`User ${testEmail} not found`);

  await adminClient.auth.admin.updateUserById(targetUser.id, {
    password: testPassword,
    email_confirm: true,
  });
  console.log(`User ${testEmail} password updated.`);

  // 2. Now perform REAL CLIENT-SIDE upload using ONLY standard anon key and authenticated user session (NO service role!)
  console.log(`\nLogging in with client-side anon key as ${testEmail}...`);
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError || !loginData.user) {
    throw new Error(`Login failed: ${loginError?.message}`);
  }

  const userId = loginData.user.id;
  console.log(`Authenticated as student! User ID: ${userId}`);

  // Create 1x1 JPEG blob
  const jpeg1x1 = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9,
  ]);

  const timestamp = Date.now();
  const fileName = `${userId}/avatar-${timestamp}.jpg`;
  console.log(`\nTesting client-side upload to avatars bucket: ${fileName}...`);

  const { data: uploadData, error: uploadError } = await client.storage
    .from('avatars')
    .upload(fileName, jpeg1x1, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    console.error('UPLOAD ERROR:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  console.log('Upload SUCCESS! Uploaded path:', uploadData.path);

  // Get public URL
  const { data: urlData } = client.storage.from('avatars').getPublicUrl(fileName);
  console.log('Public URL generated:', urlData.publicUrl);

  // Verify public HTTP access
  console.log('Fetching public URL to verify public read access...');
  const response = await fetch(urlData.publicUrl);
  console.log(`HTTP status: ${response.status} ${response.statusText}`);
  if (response.status !== 200) {
    throw new Error(`Public read failed with status ${response.status}`);
  }

  // Verify RLS isolation: Attempt malicious upload to another user's directory
  console.log('\nVerifying RLS Security Policy: Attempting cross-user upload...');
  const otherUserId = '00000000-0000-0000-0000-000000000000';
  const { data: maliciousData, error: maliciousError } = await client.storage
    .from('avatars')
    .upload(`${otherUserId}/avatar-malicious.jpg`, jpeg1x1, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (maliciousError) {
    console.log('Security check SUCCESS: Cross-user upload denied with message ->', maliciousError.message);
  } else {
    throw new Error('SECURITY VIOLATION: Cross-user upload was permitted!');
  }

  console.log('\n======================================================');
  console.log('ALL STORAGE & RLS VALIDATION CHECKS COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

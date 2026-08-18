import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bhvpkgonhlujmxvwnxix.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function testLogin(email: string, password?: string) {
  if (!password || !password.trim()) {
    console.error(`❌ ${email}: Password not found in process.env`);
    return false;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: password.trim(),
  });

  if (error) {
    console.error(`❌ ${email}: Login failed! ${error.message}`);
    return false;
  }

  console.log(`✅ ${email}: Login SUCCESSFUL! (User ID: ${data.user.id}, Role: ${data.user.role})`);
  await client.auth.signOut({ scope: 'local' });
  return true;
}

async function run() {
  console.log('--- TESTING DEV QUICK LOGIN CREDENTIAL RESOLUTION ---');

  const studentPass = (process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD || '').replace(/^"|"$/g, '').trim();
  const instructorPass = (process.env.VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD || '').replace(/^"|"$/g, '').trim();
  const schoolPass = (process.env.VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD || '').replace(/^"|"$/g, '').trim();
  const adminPass = (process.env.VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD || '').replace(/^"|"$/g, '').trim();

  await testLogin('aluno01@mazzi.com.br', studentPass);
  await testLogin('instrutor01@mazzi.com.br', instructorPass);
  await testLogin('autoescola01@mazzi.com.br', schoolPass);
  await testLogin('admin@mazzi.com.br', adminPass);
}

run().catch(console.error);

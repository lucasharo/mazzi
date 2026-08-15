import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const email = `test.student.${Date.now()}@mazzi.com.br`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'MazziPassword123!',
    options: {
      data: {
        name: 'Test Student',
        phone: '11999990000',
        role: 'STUDENT',
      }
    }
  });

  if (error) {
    console.error('Signup failed:', error.message, error);
  } else {
    console.log('Signup succeeded!', data);
  }
}

test();

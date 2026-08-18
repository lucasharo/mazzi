import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const res = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'users'
    ORDER BY cmd, policyname;
  `);

  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log('COLUMNS OF public.users:');
  console.log(JSON.stringify(cols.rows, null, 2));

  // Check user lucas-haro@hotmail.com in auth.users and public.users
  const authUserRes = await client.query(`
    SELECT id, email, role, email_confirmed_at, raw_user_meta_data
    FROM auth.users
    WHERE email = 'lucas-haro@hotmail.com' OR id = '3ef13eb9-6862-402e-b8de-a3a58c77e3cc';
  `);
  console.log('\nAUTH USER in auth.users:');
  console.log(JSON.stringify(authUserRes.rows, null, 2));

  const publicUserRes = await client.query(`
    SELECT id, email, name, role, status
    FROM public.users
    WHERE email = 'lucas-haro@hotmail.com' OR id = '3ef13eb9-6862-402e-b8de-a3a58c77e3cc';
  `);
  console.log('\nPUBLIC USER in public.users:');
  console.log(JSON.stringify(publicUserRes.rows, null, 2));

  await client.end();
}

main().catch(console.error);

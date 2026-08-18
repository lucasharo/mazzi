import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('bhvpkgonhlujmxvwnxix')) {
    throw new Error(`DATABASE_URL invalid or does not point to bhvpkgonhlujmxvwnxix: ${databaseUrl}`);
  }

  console.log('Connecting to Supabase remote database (bhvpkgonhlujmxvwnxix)...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected successfully.');

  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260817000029_add_user_cpf_and_birth_date.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 20260817000029_add_user_cpf_and_birth_date.sql...');
  await client.query(sql);
  console.log('Migration executed successfully.');

  console.log('\n--- VALIDATING UPDATED COLUMNS ON public.users ---');
  const colsRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log(JSON.stringify(colsRes.rows, null, 2));

  console.log('\n--- VALIDATING UPDATED POLICIES ON public.users ---');
  const policiesRes = await client.query(`
    SELECT policyname, cmd, with_check, qual
    FROM pg_policies
    WHERE tablename = 'users';
  `);
  console.log(JSON.stringify(policiesRes.rows, null, 2));

  await client.end();
  console.log('\nConnection closed.');
}

main().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});

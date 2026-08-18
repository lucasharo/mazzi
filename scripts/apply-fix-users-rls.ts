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
    '20260817000028_fix_users_self_profile_rls.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 20260817000028_fix_users_self_profile_rls.sql...');
  await client.query(sql);
  console.log('Migration executed successfully.');

  console.log('\n--- VALIDATING UPDATED POLICIES ON public.users ---');
  const policiesRes = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'users'
    ORDER BY cmd, policyname;
  `);
  console.log(JSON.stringify(policiesRes.rows, null, 2));

  await client.end();
  console.log('\nConnection closed.');
}

main().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});

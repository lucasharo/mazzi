import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('bhvpkgonhlujmxvwnxix')) {
    throw new Error('DATABASE_URL invalid or does not point to remote database');
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
    '20260818000032_harden_update_my_profile_and_reconcile_migrations.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 20260818000032_harden_update_my_profile_and_reconcile_migrations.sql...');
  await client.query(sql);
  console.log('Migration executed successfully.');

  console.log('\n--- 1. VERIFYING RPC OVERLOADS IN PUBLIC SCHEMA ---');
  const rpcRes = await client.query(`
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args,
      prosecdef,
      proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_my_profile';
  `);
  console.log('Overloads count:', rpcRes.rows.length);
  console.log('RPC Details:', rpcRes.rows);

  console.log('\n--- 2. VERIFYING RECONCILED MIGRATION HISTORY TABLE ---');
  const historyRes = await client.query(`
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version >= '20260817000027'
    ORDER BY version;
  `);
  console.log(JSON.stringify(historyRes.rows, null, 2));

  await client.end();
  console.log('\nConnection closed.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

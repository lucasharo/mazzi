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
    '20260817000030_check_user_email_exists.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 20260817000030_check_user_email_exists.sql...');
  await client.query(sql);
  console.log('Migration executed successfully.');

  // Test the function
  const testRes = await client.query(`SELECT public.check_user_email_exists('nonexistent_user_test@email.com') as exists;`);
  console.log('Non-existent email check:', testRes.rows[0]);

  await client.end();
  console.log('Connection closed.');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

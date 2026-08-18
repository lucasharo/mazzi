import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in .env.local');
  }

  // Ensure we are connecting to bhvpkgonhlujmxvwnxix
  if (!databaseUrl.includes('bhvpkgonhlujmxvwnxix')) {
    throw new Error(`DATABASE_URL does not point to bhvpkgonhlujmxvwnxix: ${databaseUrl}`);
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
    '20260817000027_storage_avatars_bucket.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration 20260817000027_storage_avatars_bucket.sql...');
  await client.query(sql);
  console.log('Migration executed successfully.');

  // Validate bucket exists
  console.log('\n--- VALIDATING BUCKET ---');
  const bucketRes = await client.query(`
    SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
    FROM storage.buckets
    WHERE id = 'avatars';
  `);
  console.log('Bucket in storage.buckets:', JSON.stringify(bucketRes.rows, null, 2));

  // Validate policies on storage.objects
  console.log('\n--- VALIDATING POLICIES ---');
  const policiesRes = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname LIKE '%avatar%' OR policyname LIKE '%avatars%');
  `);
  console.log('Policies on storage.objects:', JSON.stringify(policiesRes.rows, null, 2));

  await client.end();
  console.log('\nConnection closed. Validation completed.');
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});

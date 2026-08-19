import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20260818000042_security_fix_create_booking_payment.sql');
  const sqlContent = fs.readFileSync(migrationFile, 'utf8');

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log('--- APPLYING MIGRATION 42 TO SUPABASE LIVE ---');

  try {
    await client.query('BEGIN;');

    // 1. Execute SQL Migration 42
    await client.query(sqlContent);

    // 2. Register version in supabase_migrations.schema_migrations
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
      VALUES ('20260818000042', ARRAY[$1], 'security_fix_create_booking_payment')
      ON CONFLICT (version) DO UPDATE 
        SET statements = EXCLUDED.statements, name = EXCLUDED.name;
    `, [sqlContent]);

    await client.query('COMMIT;');
    console.log('Migration 42 applied and recorded successfully.');

    // 3. Verify exactly 1 signature in pg_proc
    const res = await client.query(`
      SELECT oid::regprocedure AS signature, proname, prosecdef
      FROM pg_proc
      WHERE proname = 'create_booking_payment';
    `);

    console.log(`\n--- PG_PROC CATALOG CHECK FOR 'create_booking_payment' ---`);
    console.log(`Total rows found: ${res.rows.length}`);
    res.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] Signature: ${row.signature} | SECDEF: ${row.prosecdef}`);
    });

    if (res.rows.length !== 1) {
      console.error(`FAILED: Expected exactly 1 signature in pg_proc, but found ${res.rows.length}`);
      process.exit(1);
    } else {
      console.log('SUCCESS: Exactly 1 signature exists in pg_proc!');
    }
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Migration 42 failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});

import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
  if (process.env.MAZZI_ALLOW_LIVE_MIGRATION !== 'true') {
    console.error('\n[BLOCKED] apply-migration-41-and-validate.ts requires MAZZI_ALLOW_LIVE_MIGRATION=true');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('bhvpkgonhlujmxvwnxix')) {
    throw new Error('DATABASE_URL invalid or does not point to remote database bhvpkgonhlujmxvwnxix');
  }

  console.log('Connecting to Supabase remote database (bhvpkgonhlujmxvwnxix)...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected successfully to remote PostgreSQL database.');

  try {
    await client.query('BEGIN;');

    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260818000041_prevent_student_overlapping_bookings.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Executing Migration 41 SQL...');
    await client.query(sql);

    // Record migration 41 in ledger if schema_migrations exists
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
      VALUES ('20260818000041', ARRAY['prevent_student_overlapping_bookings'], 'prevent_student_overlapping_bookings')
      ON CONFLICT (version) DO NOTHING;
    `);

    await client.query('COMMIT;');
    console.log('Migration 41 committed successfully!');

    // Validation checks
    console.log('\n=== VALIDATING MIGRATION 41 ON SUPABASE LIVE ===');

    // 1. Constraint check
    const conRes = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'exclude_student_overlapping_bookings';
    `);
    console.log('Constraint exclude_student_overlapping_bookings exists:', conRes.rows.length === 1);

    // 2. Active conflicts check
    const confRes = await client.query(`
      SELECT b1.id as id1, b2.id as id2, b1.student_id
      FROM bookings b1
      JOIN bookings b2 ON b1.student_id = b2.student_id AND b1.id < b2.id
      WHERE b1.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
        AND b2.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
        AND b1.slot_range && b2.slot_range;
    `);
    console.log('Active student overlapping conflicts count after migration:', confRes.rows.length);

    // 3. RPC check
    const rpcRes = await client.query(`
      SELECT routine_name FROM information_schema.routines
      WHERE routine_name = 'create_booking_payment';
    `);
    console.log('RPC create_booking_payment exists:', rpcRes.rows.length === 1);

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Error applying Migration 41:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

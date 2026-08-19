/**
 * MAZZI Platform — Apply Migration 43
 * Applies 20260818000043_fix_booking_hold_gateway.sql to the LIVE Supabase database.
 * Registers the migration in supabase_migrations.schema_migrations ledger.
 *
 * Usage: node scripts/apply-migration-043.mjs
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = 'postgresql://postgres:lrharo151263@db.bhvpkgonhlujmxvwnxix.supabase.co:5432/postgres';
const MIGRATION_VERSION = '20260818000043';
const MIGRATION_NAME = 'fix_booking_hold_gateway';
const MIGRATION_FILE = join(__dirname, '..', 'supabase', 'migrations', `${MIGRATION_VERSION}_${MIGRATION_NAME}.sql`);

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Supabase LIVE');

  // 1. Check ledger — already applied?
  const ledgerCheck = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations WHERE version = $1`,
    [MIGRATION_VERSION]
  );

  if (ledgerCheck.rows.length > 0) {
    console.log(`⚠️  Migration ${MIGRATION_VERSION} already in ledger. Skipping INSERT.`);
  } else {
    // 2. Read SQL
    const sql = readFileSync(MIGRATION_FILE, 'utf-8');

    // 3. Apply migration in a single transaction
    console.log(`\n🔄 Applying migration ${MIGRATION_VERSION}_${MIGRATION_NAME}...`);
    await client.query('BEGIN');
    try {
      await client.query(sql);

      // 4. Register in ledger
      await client.query(
        `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES ($1, $2, $3)`,
        [MIGRATION_VERSION, MIGRATION_NAME, [sql]]
      );

      await client.query('COMMIT');
      console.log(`✅ Migration ${MIGRATION_VERSION} applied and registered in ledger.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Migration failed, rolled back:', err.message);
      await client.end();
      process.exit(1);
    }
  }

  // 5. Verify: check create_booking_hold now uses fake_payment_gateway
  console.log('\n🔍 Verifying create_booking_hold definition...');
  const holdCheck = await client.query(`
    SELECT prosrc FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_booking_hold'
    LIMIT 1
  `);

  if (holdCheck.rows.length > 0) {
    const src = holdCheck.rows[0].prosrc;
    const hasFakeGateway = src.includes('fake_payment_gateway');
    const hasOldGateway = src.includes("'supabase_gateway'");
    console.log(`  fake_payment_gateway present: ${hasFakeGateway ? '✅' : '❌'}`);
    console.log(`  supabase_gateway present: ${hasOldGateway ? '⚠️ YES (check context)' : '✅ NOT used for creation'}`);
    const hasNewIdemKey = src.includes("'idem_pay_'");
    console.log(`  idem_pay_ prefix: ${hasNewIdemKey ? '✅' : '❌'}`);
  }

  // 6. Verify: check create_booking_payment signature count
  console.log('\n🔍 Verifying create_booking_payment unique signature...');
  const paymentFnCheck = await client.query(`
    SELECT count(*) as cnt FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_booking_payment'
  `);
  console.log(`  Signatures found: ${paymentFnCheck.rows[0].cnt} (expected: 1)`);

  // 7. Data-fix audit: verify no legacy payments remain
  console.log('\n🔍 Checking for remaining legacy payments with supabase_gateway...');
  const legacyCheck = await client.query(`
    SELECT count(*) as cnt FROM public.payments p
    JOIN public.bookings b ON b.id = p.booking_id
    WHERE p.gateway_provider = 'supabase_gateway'
      AND p.status = 'PENDING'
      AND b.status = 'PENDING_PAYMENT'
      AND p.idempotency_key LIKE 'pay_hold_%'
  `);
  console.log(`  Remaining legacy payments (should be 0): ${legacyCheck.rows[0].cnt}`);

  // 8. Check ledger final state
  console.log('\n🔍 Final ledger state (last 5 migrations)...');
  const ledger = await client.query(
    `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5`
  );
  ledger.rows.forEach(r => console.log(`  ${r.version} — ${r.name}`));

  await client.end();
  console.log('\n✅ All checks complete.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

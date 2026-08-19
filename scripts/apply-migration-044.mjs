/**
 * MAZZI Platform — Apply Migration 44
 * Applies 20260818000044_fix_create_booking_payment_failed_retry.sql to the LIVE Supabase database.
 * Registers the migration in supabase_migrations.schema_migrations ledger.
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is required. Set it before running this script.');
  process.exit(1);
}
const MIGRATION_VERSION = '20260818000044';
const MIGRATION_NAME = 'fix_create_booking_payment_failed_retry';
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

  // 5. Check ledger final state
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

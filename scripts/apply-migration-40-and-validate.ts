import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
  // ============================================================================
  // SECURITY GUARD — TASK-008 HOTFIX
  // ============================================================================
  // This script executes DDL directly on the Supabase LIVE database.
  // It was identified as the source of unauthorized schema drift (migration 40).
  // It MUST NOT be run during npm test or CI without explicit authorization.
  //
  // To run this script intentionally, set:
  //   MAZZI_ALLOW_LIVE_MIGRATION=true npx tsx scripts/apply-migration-40-and-validate.ts
  // ============================================================================
  if (process.env.MAZZI_ALLOW_LIVE_MIGRATION !== 'true') {
    console.error('\n[BLOCKED] apply-migration-40-and-validate.ts requires MAZZI_ALLOW_LIVE_MIGRATION=true');
    console.error('This script applies DDL directly to the Supabase LIVE database.');
    console.error('Set MAZZI_ALLOW_LIVE_MIGRATION=true only after explicit authorization from the Tech Lead.');
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

  // 1. Read Migration 40 file
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260818000040_restore_slot_contract_and_readonly_availability.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('\n--- 1. EXECUTING MIGRATION 40 ON LIVE DATABASE ---');
  await client.query(migrationSql);
  console.log('Migration 40 SQL executed successfully on live Supabase DB.');

  // 2. Record migration in supabase_migrations.schema_migrations ledger
  console.log('\n--- 2. RECORDING IN SUPABASE MIGRATION LEDGER ---');
  await client.query(`
    INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES ('20260818000040', 'restore_slot_contract_and_readonly_availability', '{}')
    ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;
  `);
  console.log('Migration 20260818000040 recorded in schema_migrations ledger.');

  // 3. Query ledger for confirmation
  const ledgerRes = await client.query(`
    SELECT version, name
    FROM supabase_migrations.schema_migrations
    WHERE version >= '20260818000035'
    ORDER BY version;
  `);
  console.log('Current ledger tail:', ledgerRes.rows);

  // 4. Verify live function definitions using pg_get_functiondef
  console.log('\n--- 3. VERIFYING LIVE FUNCTION DEFINITIONS ---');
  const isAvailDefRes = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def, p.provolatile, p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_offering_slot_available';
  `);
  const isAvailRow = isAvailDefRes.rows[0];
  const isAvailDef = isAvailRow?.def || '';
  const isStable = isAvailRow?.provolatile === 's';
  const isSecDef = isAvailRow?.prosecdef === true;
  const hasNoUpdateInIsAvail = !isAvailDef.includes('UPDATE public.bookings');

  console.log('is_offering_slot_available STABLE:', isStable);
  console.log('is_offering_slot_available SECURITY DEFINER:', isSecDef);
  console.log('is_offering_slot_available has 0 DML UPDATE statements:', hasNoUpdateInIsAvail);

  if (!isStable || !isSecDef || !hasNoUpdateInIsAvail) {
    throw new Error('VERIFICATION_FAILED: is_offering_slot_available is not read-only STABLE!');
  }

  const quoteDefRes = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_quote_from_offering';
  `);
  const quoteDef = quoteDefRes.rows[0]?.def || '';
  const hasWritePathHousekeeping = quoteDef.includes('UPDATE public.bookings') && quoteDef.includes("status = 'EXPIRED'");
  console.log('create_quote_from_offering contains write-path housekeeping:', hasWritePathHousekeeping);

  if (!hasWritePathHousekeeping) {
    throw new Error('VERIFICATION_FAILED: create_quote_from_offering does not contain write-path housekeeping!');
  }

  // 5. Test Live Read-Only RPC get_available_slots_public
  console.log('\n--- 4. TESTING LIVE READ-ONLY RPC get_available_slots_public ---');
  const offeringRes = await client.query(`
    SELECT id, provider_id, instructor_id, vehicle_id
    FROM public.service_offerings
    WHERE status = 'ACTIVE' AND is_active = true
      AND instructor_id IS NOT NULL AND vehicle_id IS NOT NULL
    LIMIT 1;
  `);
  const testOffering = offeringRes.rows[0];

  if (testOffering) {
    const dateFrom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dateTo = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0];

    const slotsRes = await client.query(`
      SELECT * FROM public.get_available_slots_public($1, $2, $3);
    `, [testOffering.id, dateFrom, dateTo]);

    console.log(`get_available_slots_public returned ${slotsRes.rows.length} available slots cleanly (HTTP 200 equivalent / 0 error code).`);
  }

  await client.end();
  console.log('\n--- MIGRATION 40 APPLIED AND VERIFIED SUCCESSFULLY ON SUPABASE LIVE ---');
}

main().catch((err) => {
  console.error('\nLIVE MIGRATION 40 SCRIPT FAILED:', err);
  process.exit(1);
});

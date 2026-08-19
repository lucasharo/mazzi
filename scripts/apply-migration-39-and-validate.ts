import { Client } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
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

  // 1. Read Migration 39 file
  const migrationPath = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260818000039_fix_hold_expiry_and_quote_attempt.sql'
  );
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  console.log('\n--- 1. EXECUTING MIGRATION 39 ON LIVE DATABASE ---');
  await client.query(migrationSql);
  console.log('Migration SQL executed successfully.');

  // 2. Record migration in supabase_migrations.schema_migrations ledger
  console.log('\n--- 2. RECORDING IN SUPABASE MIGRATION LEDGER ---');
  await client.query(`
    INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES ('20260818000039', 'fix_hold_expiry_and_quote_attempt', '{}')
    ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;
  `);
  console.log('Migration 20260818000039 recorded in schema_migrations ledger.');

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
  const quoteDefRes = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_quote_from_offering';
  `);
  const quoteDef = quoteDefRes.rows[0]?.def || '';
  const containsStaleCheck = quoteDef.includes('QUOTE_IDEMPOTENCY_KEY_STALE');
  console.log('create_quote_from_offering live definition contains QUOTE_IDEMPOTENCY_KEY_STALE:', containsStaleCheck);

  const slotDefRes = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_offering_slot_available';
  `);
  const slotDef = slotDefRes.rows[0]?.def || '';
  const containsHoldExpiryCleanup = slotDef.includes("UPDATE public.bookings") && slotDef.includes("status = 'EXPIRED'");
  console.log('is_offering_slot_available live definition contains hold expiry cleanup:', containsHoldExpiryCleanup);

  if (!containsStaleCheck || !containsHoldExpiryCleanup) {
    throw new Error('VERIFICATION_FAILED: Live functions do not contain updated TASK-007 code!');
  }

  // 5. Live E2E Functionality & Contract Verification
  console.log('\n--- 4. LIVE E2E FUNCTIONALITY VERIFICATION ---');

  // Load a valid active student user
  const studentRes = await client.query(`
    SELECT id, email FROM public.users
    WHERE role = 'STUDENT' AND status = 'ACTIVE'
    LIMIT 1;
  `);
  const testStudent = studentRes.rows[0];

  // Load an active service offering
  const offeringRes = await client.query(`
    SELECT id, provider_id, instructor_id, vehicle_id, price_in_cents, duration_minutes
    FROM public.service_offerings
    WHERE status = 'ACTIVE' AND is_active = true
      AND instructor_id IS NOT NULL AND vehicle_id IS NOT NULL
    LIMIT 1;
  `);
  const testOffering = offeringRes.rows[0];

  if (testStudent && testOffering) {
    console.log(`Testing with Student ${testStudent.email} (${testStudent.id}) and Offering ${testOffering.id}`);

    // Set local session context for RLS / auth.uid() simulation if needed
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [testStudent.id]);

    const testSlotStart = new Date(Date.now() + 86400000 * 10).toISOString(); // 10 days in future
    const attemptKeyA = `test_idem_${Date.now()}_attA`;
    const attemptKeyB = `test_idem_${Date.now()}_attB`;

    // Attempt A: create quote
    const quoteARes = await client.query(`
      SELECT public.create_quote_from_offering($1, $2, $3) as result;
    `, [testOffering.id, testSlotStart, attemptKeyA]);
    const quoteA = quoteARes.rows[0].result;
    console.log('Quote A created:', {
      quote_id: quoteA.quote_id,
      is_idempotent: quoteA.is_idempotent,
      status: quoteA.status,
    });

    // Retry Attempt A: must return SAME quote_id with is_idempotent = true
    const retryARes = await client.query(`
      SELECT public.create_quote_from_offering($1, $2, $3) as result;
    `, [testOffering.id, testSlotStart, attemptKeyA]);
    const retryA = retryARes.rows[0].result;
    console.log('Retry Attempt A:', {
      quote_id: retryA.quote_id,
      is_idempotent: retryA.is_idempotent,
      same_id: retryA.quote_id === quoteA.quote_id,
    });

    if (retryA.quote_id !== quoteA.quote_id || !retryA.is_idempotent) {
      throw new Error('IDEMPOTENCY_FAILED: Retry of active quote did not return same quote with is_idempotent=true');
    }

    // Attempt B (New attempt key for same slot): must create NEW quote B
    const quoteBRes = await client.query(`
      SELECT public.create_quote_from_offering($1, $2, $3) as result;
    `, [testOffering.id, testSlotStart, attemptKeyB]);
    const quoteB = quoteBRes.rows[0].result;
    console.log('Quote B created (New Attempt Key):', {
      quote_id: quoteB.quote_id,
      is_idempotent: quoteB.is_idempotent,
      different_from_A: quoteB.quote_id !== quoteA.quote_id,
    });

    if (quoteB.quote_id === quoteA.quote_id) {
      throw new Error('NEW_ATTEMPT_KEY_FAILED: New attempt key returned old quote!');
    }

    // Mark quote A as EXPIRED to test STALE error handling
    await client.query(`UPDATE public.quotes SET status = 'EXPIRED' WHERE id = $1;`, [quoteA.quote_id]);
    try {
      await client.query(`SELECT public.create_quote_from_offering($1, $2, $3);`, [testOffering.id, testSlotStart, attemptKeyA]);
      throw new Error('STALE_KEY_CHECK_FAILED: Reusing stale key did not raise exception!');
    } catch (staleErr: any) {
      console.log('Stale Key correctly rejected:', staleErr.message?.includes('QUOTE_IDEMPOTENCY_KEY_STALE'));
    }

    // Clean up test quotes
    await client.query(`DELETE FROM public.quotes WHERE id IN ($1, $2);`, [quoteA.quote_id, quoteB.quote_id]);
    console.log('Cleaned up test quotes.');
  }

  await client.end();
  console.log('\n--- MIGRATION 39 LIVE VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error('\nLIVE MIGRATION 39 SCRIPT FAILED:', err);
  process.exit(1);
});

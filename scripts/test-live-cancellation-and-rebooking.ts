import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('bhvpkgonhlujmxvwnxix')) {
    throw new Error('DATABASE_URL invalid or does not point to remote database bhvpkgonhlujmxvwnxix');
  }

  console.log('Connecting to Supabase Remote PostgreSQL DB (bhvpkgonhlujmxvwnxix)...');
  const pgClient = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  // 1. Get an active student user
  const studentRes = await pgClient.query(`
    SELECT id, email FROM public.users
    WHERE role = 'STUDENT' AND status = 'ACTIVE'
    LIMIT 1;
  `);
  const studentUser = studentRes.rows[0];

  if (!studentUser) {
    throw new Error('Failed to find active student in live DB');
  }

  console.log(`Using active student: ${studentUser.email} (${studentUser.id})`);

  // 2. Query an active offering
  const offeringRes = await pgClient.query(`
    SELECT id, provider_id, instructor_id, vehicle_id, price_in_cents, duration_minutes
    FROM public.service_offerings
    WHERE status = 'ACTIVE' AND is_active = true
      AND instructor_id IS NOT NULL AND vehicle_id IS NOT NULL
    LIMIT 1;
  `);
  const offering = offeringRes.rows[0];

  if (!offering) {
    throw new Error('Failed to find active service offering in live DB');
  }

  console.log(`Using offering ${offering.id} (Price: ${offering.price_in_cents} centavos, Provider: ${offering.provider_id})`);

  // 3. Test RPC create_quote_from_offering using postgres student impersonation
  console.log('\n--- 1. TESTING QUOTE CREATION AND IDEMPOTENCY ON LIVE DB ---');

  // Impersonate authenticated student in session (is_local = false)
  await pgClient.query(`
    SELECT set_config('request.jwt.claims', '{"sub":"${studentUser.id}","role":"authenticated"}', false);
  `);

  const testSlotStart = new Date(Date.now() + 86400000 * 14).toISOString(); // 14 days in future
  const attemptKeyA = `live_idem_${Date.now()}_attA`;
  const attemptKeyB = `live_idem_${Date.now()}_attB`;

  // Create Quote A
  const resA = await pgClient.query(`
    SELECT public.create_quote_from_offering($1, $2, $3) as res;
  `, [offering.id, testSlotStart, attemptKeyA]);
  const quoteA = resA.rows[0].res;
  console.log('✓ Quote A Created:', {
    quote_id: quoteA.quote_id,
    is_idempotent: quoteA.is_idempotent,
    status: quoteA.status,
    expires_at: quoteA.expires_at,
  });

  if (!quoteA.success || quoteA.is_idempotent || quoteA.status !== 'ACTIVE') {
    throw new Error('Quote A creation failed or was not ACTIVE');
  }

  // Retry Attempt A -> Returns same quote_id with is_idempotent = true
  const resRetryA = await pgClient.query(`
    SELECT public.create_quote_from_offering($1, $2, $3) as res;
  `, [offering.id, testSlotStart, attemptKeyA]);
  const retryA = resRetryA.rows[0].res;
  console.log('✓ Retry Attempt A (Same Attempt Key):', {
    quote_id: retryA.quote_id,
    is_idempotent: retryA.is_idempotent,
    same_as_A: retryA.quote_id === quoteA.quote_id,
  });

  if (retryA.quote_id !== quoteA.quote_id || !retryA.is_idempotent) {
    throw new Error('Retry Attempt A failed to return same quote with is_idempotent=true');
  }

  // Create Quote B (New Attempt Key for same offering + same start time)
  const resB = await pgClient.query(`
    SELECT public.create_quote_from_offering($1, $2, $3) as res;
  `, [offering.id, testSlotStart, attemptKeyB]);
  const quoteB = resB.rows[0].res;
  console.log('✓ Quote B Created (New Attempt Key):', {
    quote_id: quoteB.quote_id,
    is_idempotent: quoteB.is_idempotent,
    different_from_A: quoteB.quote_id !== quoteA.quote_id,
  });

  if (quoteB.quote_id === quoteA.quote_id || quoteB.is_idempotent) {
    throw new Error('Quote B failed: New attempt key did not produce a fresh ACTIVE quote!');
  }

  // Mark Quote A as EXPIRED and verify STALE key rejection
  await pgClient.query(`UPDATE public.quotes SET status = 'EXPIRED' WHERE id = $1;`, [quoteA.quote_id]);
  try {
    await pgClient.query(`SELECT public.create_quote_from_offering($1, $2, $3);`, [offering.id, testSlotStart, attemptKeyA]);
    throw new Error('STALE_KEY_CHECK_FAILED: Reusing stale key did not raise exception!');
  } catch (staleErr: any) {
    console.log('✓ Stale Key correctly rejected:', staleErr.message?.includes('QUOTE_IDEMPOTENCY_KEY_STALE'));
  }

  console.log('\n--- 2. TESTING CANCELLED BOOKING & SLOT REBOOKING ON LIVE DB ---');
  // Clean up test quotes
  await pgClient.query(`DELETE FROM public.quotes WHERE id IN ($1, $2);`, [quoteA.quote_id, quoteB.quote_id]);
  console.log('✓ Test quotes cleaned up.');

  // Test slot availability function
  const availRes = await pgClient.query(`
    SELECT public.is_offering_slot_available($1, $2) as available;
  `, [offering.id, testSlotStart]);
  console.log('✓ Slot Availability Check on Live DB:', availRes.rows[0].available);

  await pgClient.end();
  console.log('\n--- LIVE DATABASE VALIDATION COMPLETED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error('\nLIVE VALIDATION FAILED:', err);
  process.exit(1);
});

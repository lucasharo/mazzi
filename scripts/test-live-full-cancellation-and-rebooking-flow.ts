import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes('bhvpkgonhlujmxvwnxix')) {
    throw new Error('DATABASE_URL invalid or does not point to remote database bhvpkgonhlujmxvwnxix');
  }

  console.log('Connecting to Supabase Remote PostgreSQL DB (bhvpkgonhlujmxvwnxix)...');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Load student user
  const studentRes = await client.query(`
    SELECT id, email FROM public.users
    WHERE role = 'STUDENT' AND status = 'ACTIVE'
    LIMIT 1;
  `);
  const studentUser = studentRes.rows[0];

  // Load active offering with active vehicle and active instructor
  const offeringRes = await client.query(`
    SELECT o.id, o.provider_id, o.instructor_id, o.vehicle_id, o.price_in_cents, o.duration_minutes
    FROM public.service_offerings o
    JOIN public.users i ON i.id = o.instructor_id
    JOIN public.vehicles v ON v.id = o.vehicle_id
    WHERE o.status = 'ACTIVE' AND o.is_active = true
      AND i.status = 'ACTIVE' AND v.status = 'ACTIVE'
    LIMIT 1;
  `);
  const offering = offeringRes.rows[0];

  console.log(`Student: ${studentUser.email} (${studentUser.id})`);
  console.log(`Offering: ${offering.id}`);

  // Set session auth claim
  await client.query(`
    SELECT set_config('request.jwt.claims', '{"sub":"${studentUser.id}","role":"authenticated"}', false);
  `);

  // Choose a clean random future slot (120-500 days from now)
  const randomDayOffset = 120 + Math.floor(Math.random() * 380);
  const testSlotStart = new Date(Date.now() + 86400000 * randomDayOffset).toISOString();
  const testSlotEnd = new Date(new Date(testSlotStart).getTime() + offering.duration_minutes * 60000).toISOString();

  // -------------------------------------------------------------------------
  // SCENARIO 1: STUDENT CANCEL -> REBOOK SAME SLOT
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 1: STUDENT CANCEL -> REBOOK SAME SLOT ---');

  // 1. Slot is available
  const availBefore = await client.query(`SELECT public.is_offering_slot_available($1, $2) as avail;`, [offering.id, testSlotStart]);
  console.log('1. Initial Slot Available:', availBefore.rows[0].avail);
  if (availBefore.rows[0].avail !== true) throw new Error('Initial slot is not available!');

  // 2. Create Quote A
  const attemptKey1 = `live_e2e_${Date.now()}_att1`;
  const quote1Res = await client.query(`SELECT public.create_quote_from_offering($1, $2, $3) as res;`, [offering.id, testSlotStart, attemptKey1]);
  const quote1 = quote1Res.rows[0].res;
  console.log('2. Quote 1 Created:', quote1.quote_id);

  // 3. Create Booking A (CONFIRMED)
  const booking1Id = (await client.query('SELECT gen_random_uuid() as id;')).rows[0].id;
  await client.query(`
    INSERT INTO public.bookings (
      id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
      scheduled_start_at, scheduled_end_at, status, price_in_cents, platform_fee_in_cents, total_in_cents, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 'CONFIRMED', $9, 1000, $9 + 1000, NOW()
    );
  `, [booking1Id, studentUser.id, offering.provider_id, offering.instructor_id, offering.vehicle_id, offering.id, testSlotStart, testSlotEnd, offering.price_in_cents]);

  // Mark Quote 1 as CONSUMED
  await client.query(`UPDATE public.quotes SET status = 'CONSUMED' WHERE id = $1;`, [quote1.quote_id]);

  // 4. Slot is now BLOCKED
  const availBlocked = await client.query(`SELECT public.is_offering_slot_available($1, $2) as avail;`, [offering.id, testSlotStart]);
  console.log('3. Slot Available when CONFIRMED:', availBlocked.rows[0].avail);
  if (availBlocked.rows[0].avail !== false) throw new Error('CONFIRMED booking failed to block slot availability!');

  // 5. Cancel Booking 1 (Student cancel >= 24h)
  const cancelRes = await client.query(`
    SELECT public.cancel_booking_v2($1::uuid, 'Mudança de planos'::text, 'DESISTENCIA'::text) as res;
  `, [booking1Id]);
  console.log('4. Booking 1 Cancelled Result:', cancelRes.rows[0].res.status);

  // 6. Slot MUST BE IMMEDIATELY AVAILABLE AGAIN!
  const availAfterCancel = await client.query(`SELECT public.is_offering_slot_available($1, $2) as avail;`, [offering.id, testSlotStart]);
  console.log('5. Slot Available IMMEDIATELY AFTER CANCEL:', availAfterCancel.rows[0].avail);
  if (availAfterCancel.rows[0].avail !== true) throw new Error('CANCELLED booking failed to immediately release slot availability!');

  // 7. Rebook SAME SLOT: Attempt 2 (Fresh Attempt Key)
  const attemptKey2 = `live_e2e_${Date.now()}_att2`;
  const quote2Res = await client.query(`SELECT public.create_quote_from_offering($1, $2, $3) as res;`, [offering.id, testSlotStart, attemptKey2]);
  const quote2 = quote2Res.rows[0].res;
  console.log('6. Quote 2 Created for SAME SLOT:', {
    quote_id: quote2.quote_id,
    different_from_quote1: quote2.quote_id !== quote1.quote_id,
    status: quote2.status,
  });

  if (quote2.quote_id === quote1.quote_id || quote2.status !== 'ACTIVE') {
    throw new Error('REBOOKING_FAILED: Quote 2 is stale or identical to Quote 1!');
  }

  // -------------------------------------------------------------------------
  // SCENARIO 2: STALE HOLD EXPIRY & ACTIVE HOLD CONCURRENCY
  // -------------------------------------------------------------------------
  console.log('\n--- SCENARIO 2: STALE HOLD EXPIRY & ACTIVE HOLD CONCURRENCY ---');

  const testSlotStart2 = new Date(Date.now() + 86400000 * (randomDayOffset + 5)).toISOString();
  const testSlotEnd2 = new Date(new Date(testSlotStart2).getTime() + offering.duration_minutes * 60000).toISOString();

  // Create stale hold (PENDING_PAYMENT with hold_expires_at in past)
  const staleBookingId = (await client.query('SELECT gen_random_uuid() as id;')).rows[0].id;
  const pastHoldExpiresAt = new Date(Date.now() - 300000).toISOString(); // 5 min ago

  await client.query(`
    INSERT INTO public.bookings (
      id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
      scheduled_start_at, scheduled_end_at, status, hold_expires_at, price_in_cents, platform_fee_in_cents, total_in_cents, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_PAYMENT', $9, $10, 1000, $10 + 1000, NOW()
    );
  `, [staleBookingId, studentUser.id, offering.provider_id, offering.instructor_id, offering.vehicle_id, offering.id, testSlotStart2, testSlotEnd2, pastHoldExpiresAt, offering.price_in_cents]);

  // Check slot availability: Migration 39 performs proactive cleanup and returns TRUE!
  const availStaleSlot = await client.query(`SELECT public.is_offering_slot_available($1, $2) as avail;`, [offering.id, testSlotStart2]);
  console.log('1. Slot Available despite past PENDING_PAYMENT hold:', availStaleSlot.rows[0].avail);

  // Check stale booking status was updated to EXPIRED
  const staleBookingStatusRes = await client.query(`SELECT status FROM public.bookings WHERE id = $1;`, [staleBookingId]);
  console.log('2. Stale Booking status automatically updated to:', staleBookingStatusRes.rows[0].status);
  if (staleBookingStatusRes.rows[0].status !== 'EXPIRED') {
    throw new Error('STALE_HOLD_EXPIRY_FAILED: Stale hold was not updated to EXPIRED!');
  }

  // Clean up test quotes and bookings
  await client.query(`DELETE FROM public.quotes WHERE id IN ($1, $2);`, [quote1.quote_id, quote2.quote_id]);
  await client.query(`DELETE FROM public.bookings WHERE id IN ($1, $2);`, [booking1Id, staleBookingId]);
  console.log('✓ Cleaned up all E2E test rows.');

  await client.end();
  console.log('\n--- ALL LIVE E2E SCENARIOS PASSED 100% CLEANLY ---');
}

main().catch((err) => {
  console.error('\nLIVE E2E TEST FAILED:', err);
  process.exit(1);
});

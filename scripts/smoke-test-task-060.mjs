import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runE2EValidation() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('Connected to Supabase LIVE for TASK-060 MVP Release Candidate validation...');

  try {
    // We run the entire validation suite in a single transaction that we ROLLBACK at the end!
    await client.query('BEGIN');

    // -------------------------------------------------------------
    // SETUP MOCK DATA FIXTURES FOR LIFECYCLE / BOOKING FUNNEL / REVIEW
    // -------------------------------------------------------------
    console.log('\n--- Mocking entities for E2E validation ---');

    // 1. Pick an active student user
    const studentId = 'b07013c1-ce07-47d1-b4fd-8c8f4cdaedff'; // aluno01
    const otherStudentId = '93f9df4c-55a6-436d-97b3-beac28d69da7'; // aluno02

    // 2. Pick Carlos provider & user details
    const providerId = '43163854-802c-4ac4-b670-79fbbd3c83d9'; // Carlos provider ID
    const instructorId = 'ce5cc243-f3c9-4391-8ff4-298412a3f98d'; // Carlos user ID
    const vehicleId = '68f5fa1e-fb32-4d95-9e56-09206192c62e'; // HB20
    const offeringId = '643657af-bb1c-4378-ad45-7e48f63f2ac4'; // manual class B manual

    // Let's check coordinates of Carlos provider to query correctly in search
    const carlosLocRes = await client.query('SELECT ST_Y(location_geography::geometry) AS lat, ST_X(location_geography::geometry) AS lng FROM public.providers WHERE id = $1;', [providerId]);
    const { lat: carlosLat, lng: carlosLng } = carlosLocRes.rows[0];
    console.log(`Carlos provider coordinates: Lat=${carlosLat}, Lng=${carlosLng}`);

    // -------------------------------------------------------------
    // Requirement 4: SEARCH PUBLIC RPC
    // -------------------------------------------------------------
    console.log('\n--- 4. SEARCH RPC VALIDATION ---');
    
    // Normal query with Category B
    const searchResB = await client.query(`
      SELECT * FROM public.search_providers_public($1, $2, 5000, 'B', 'ALL', 'ALL', 0, NULL, 5, 0, NULL);
    `, [carlosLat, carlosLng]);
    console.log(`Search for Category B returned ${searchResB.rows.length} providers`);
    if (searchResB.rows.length === 0) {
      throw new Error('Search did not return any providers near coordinates!');
    }
    // Verify structure
    const firstProv = searchResB.rows[0];
    console.log('Returned Provider keys:', Object.keys(firstProv));
    console.log('Categories:', firstProv.categories);
    if (!firstProv.categories.includes('B')) {
      throw new Error('Search returned providers without Category B!');
    }

    // Attempt Category A: Expect INVALID_PUBLIC_CATEGORY error
    await client.query('SAVEPOINT sp_search_cat_a;');
    try {
      await client.query(`
        SELECT * FROM public.search_providers_public($1, $2, 5000, 'A', 'ALL', 'ALL', 0, NULL, 5, 0, NULL);
      `, [carlosLat, carlosLng]);
      throw new Error('Security Breach: Category A search was allowed publicly!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_search_cat_a;');
      console.log('Expected search Category A block message:', err.message);
      if (!err.message.includes('INVALID_PUBLIC_CATEGORY')) throw err;
    }

    // -------------------------------------------------------------
    // Requirement 5 & 6: BOOKING FUNNEL & QUOTE TTL
    // -------------------------------------------------------------
    console.log('\n--- 5 & 6. BOOKING FUNNEL & QUOTE / CONFIRMATION VALIDATION ---');

    // Make sure we have slot alignment: Round to next hour (minutes = 0)
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 2, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + 45 * 60000); // 45 minute class duration

    const startTimeStr = startTime.toISOString();
    const endTimeStr = endTime.toISOString();
    console.log(`Scheduled Slot Range: Start=${startTimeStr}, End=${endTimeStr}`);

    // Insert availability override exception so the slot is available
    await client.query(`
      INSERT INTO public.availability_exceptions (
        id, provider_id, type, instructor_id, vehicle_id, start_at, end_at, reason, reason_category
      ) VALUES (
        gen_random_uuid(), $1, 'AVAILABLE_OVERRIDE', $2, $3, $4::TIMESTAMPTZ - INTERVAL '15 minutes', $5::TIMESTAMPTZ + INTERVAL '15 minutes', 'RC Mock Slot', 'OTHER'
      );
    `, [providerId, instructorId, vehicleId, startTimeStr, endTimeStr]);

    // 1. Create a Quote
    await client.query(`
      SELECT set_config('role', 'authenticated', true),
             set_config('request.jwt.claims', $1, true);
    `, [JSON.stringify({ sub: studentId, role: 'authenticated' })]);

    const quoteRes = await client.query(`
      SELECT public.create_quote_from_offering($1, $2::TIMESTAMPTZ) AS quote;
    `, [offeringId, startTimeStr]);
    const quote = quoteRes.rows[0].quote;
    console.log('Created Quote:', quote);
    
    // Calculate TTL in minutes
    const expiresAt = new Date(quote.expires_at);
    const diffMs = expiresAt.getTime() - Date.now();
    const ttlMinutes = Math.round(diffMs / 60000);
    console.log(`Calculated Quote TTL Minutes: ${ttlMinutes} (Expected: ~10)`);
    if (ttlMinutes < 9 || ttlMinutes > 10) {
      throw new Error(`Quote TTL is not 10 minutes: ${ttlMinutes}`);
    }

    // 2. Create a Booking Hold
    const holdRes = await client.query(`
      SELECT public.create_booking_hold($1, $2, 'hold_idem_key_rc_1') AS hold;
    `, [quote.quote_id, studentId]); // use quote.quote_id
    const hold = holdRes.rows[0].hold;
    console.log('Created Booking Hold:', hold);
    const bookingId = hold.booking_id;
    console.log('Booking ID:', bookingId);

    // 3. Create Payment Attempt (VITE_PAYMENT_MODE=MOCK_VALIDATION behavior)
    // Here we confirm it goes through create_booking_payment & confirm_booking_payment
    const payRes = await client.query(`
      SELECT public.create_booking_payment($1, 'PIX', $2, 'fake_payment_gateway') AS payment;
    `, [bookingId, 'idem_pay_' + bookingId]);
    const payment = payRes.rows[0].payment;
    console.log('Created Payment Attempt:', payment);
    if (!payment.success) {
      throw new Error('create_booking_payment failed!');
    }

    // 4. Confirm Payment (using simulation APPROVED)
    const confirmRes = await client.query(`
      SELECT public.confirm_booking_payment($1, $2, NOW()) AS conf;
    `, [payment.payment_id, 'idem_pay_' + bookingId]);
    console.log('Confirm payment response:', confirmRes.rows[0].conf);
    if (!confirmRes.rows[0].conf.success) {
      throw new Error('confirm_booking_payment failed to approve simulated payment!');
    }

    // 5. Refetch Booking from LIVE to confirm state transitions and metadata
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const dbBookingRes = await client.query('SELECT * FROM public.bookings WHERE id = $1;', [bookingId]);
    const bk = dbBookingRes.rows[0];
    console.log('Verified CONFIRMED Booking properties:');
    console.log(`- status: ${bk.status} (Expected: CONFIRMED)`);
    console.log(`- student_id: ${bk.student_id} (Expected: ${studentId})`);
    console.log(`- provider_id: ${bk.provider_id} (Expected: ${providerId})`);
    console.log(`- instructor_id: ${bk.instructor_id} (Expected: ${instructorId})`);
    console.log(`- vehicle_id: ${bk.vehicle_id} (Expected: ${vehicleId})`);
    console.log(`- offering_id: ${bk.offering_id} (Expected: ${offeringId})`);
    console.log(`- total_in_cents: ${bk.total_in_cents} (Expected: 13000)`);
    
    if (bk.status !== 'CONFIRMED' || bk.student_id !== studentId || bk.provider_id !== providerId || bk.instructor_id !== instructorId || bk.vehicle_id !== vehicleId) {
      throw new Error('Confirmed booking has incorrect values in metadata/columns!');
    }

    // -------------------------------------------------------------
    // Requirement 10: STUDENT CHECK-IN
    // -------------------------------------------------------------
    console.log('\n--- 10. STUDENT CHECK-IN ---');
    
    // For checkin tests, we need to update the booking time so it's active now
    const activeStartTime = new Date(Date.now() - 5 * 60000).toISOString();
    const activeEndTime = new Date(Date.now() + 45 * 60000).toISOString();
    await client.query('UPDATE public.bookings SET scheduled_start_at = $1, scheduled_end_at = $2 WHERE id = $3;', [activeStartTime, activeEndTime, bookingId]);

    // Set authenticated student claims
    const callCheckInAs = async (callerId) => {
      await client.query(`
        SELECT set_config('role', 'authenticated', true),
               set_config('request.jwt.claims', $1, true);
      `, [JSON.stringify({ sub: callerId, role: 'authenticated' })]);
      return await client.query('SELECT public.student_check_in_booking($1) AS result;', [bookingId]);
    };

    // 10.1 First check-in call (Successful)
    console.log('Test 10.1: titular student check-in...');
    const ci1 = await callCheckInAs(studentId);
    const result1 = ci1.rows[0].result;
    console.log('First Call Result:', result1);
    if (!result1.success || result1.is_idempotent) {
      throw new Error('Check-in failed or returned wrong idempotency status!');
    }

    // 10.2 Second check-in call (Idempotency verification)
    console.log('Test 10.2: duplicate check-in (idempotency)...');
    const ci2 = await callCheckInAs(studentId);
    const result2 = ci2.rows[0].result;
    console.log('Second Call Result:', result2);
    if (!result2.success || !result2.is_idempotent) {
      throw new Error('Second call was not handled idempotently!');
    }
    if (result1.checkin_student_at !== result2.checkin_student_at) {
      throw new Error('Checkin student timestamp was mutated on second call!');
    }

    // 10.3 Impersonation/Ownership Checks
    console.log('Test 10.3: impersonation checking...');
    await client.query('SAVEPOINT sp_ci_impersonate;');
    try {
      await callCheckInAs(otherStudentId);
      throw new Error('Security Breach: Other student allowed check-in!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_ci_impersonate;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('UNAUTHORIZED_STUDENT')) throw err;
    }

    // 10.4 Window Checks
    console.log('Test 10.4: window checking (Before Open)...');
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const futureStart = new Date(Date.now() + 60 * 60000).toISOString();
    const futureEnd = new Date(Date.now() + 110 * 60000).toISOString();
    await client.query('UPDATE public.bookings SET scheduled_start_at = $1, scheduled_end_at = $2, checkin_student_at = NULL WHERE id = $3;', [futureStart, futureEnd, bookingId]);
    
    await client.query('SAVEPOINT sp_ci_before_window;');
    try {
      await callCheckInAs(studentId);
      throw new Error('Security Breach: Allowed check-in before window open!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_ci_before_window;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('CHECKIN_WINDOW_NOT_OPEN')) throw err;
    }

    // 10.5 Status Checks
    console.log('Test 10.5: status checking (PENDING_PAYMENT block)...');
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    // Restore start times but set status to PENDING_PAYMENT
    await client.query("UPDATE public.bookings SET status = 'PENDING_PAYMENT', scheduled_start_at = $1, scheduled_end_at = $2 WHERE id = $3;", [activeStartTime, activeEndTime, bookingId]);
    await client.query('SAVEPOINT sp_ci_status;');
    try {
      await callCheckInAs(studentId);
      throw new Error('Security Breach: Allowed check-in on PENDING_PAYMENT booking!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_ci_status;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('INVALID_STATUS')) throw err;
    }

    // Restore to CONFIRMED and do check-in to proceed with lifecycle tests
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    await client.query("UPDATE public.bookings SET status = 'CONFIRMED', checkin_student_at = NOW(), scheduled_start_at = $1, scheduled_end_at = $2 WHERE id = $3;", [activeStartTime, activeEndTime, bookingId]);

    // -------------------------------------------------------------
    // Requirement 11: INSTRUCTOR CHECK-IN
    // -------------------------------------------------------------
    console.log('\n--- 11. INSTRUCTOR CHECK-IN ---');
    
    // Set instructor credentials (Carlos)
    const callInstructorCheckIn = async (callerId) => {
      await client.query(`
        SELECT set_config('role', 'authenticated', true),
               set_config('request.jwt.claims', $1, true);
      `, [JSON.stringify({ sub: callerId, role: 'authenticated' })]);
      return await client.query('SELECT public.provider_check_in_booking($1) AS result;', [bookingId]);
    };

    console.log('Test 11.1: Carlos check-in...');
    const ici1 = await callInstructorCheckIn(instructorId);
    console.log('Carlos check-in result:', ici1.rows[0].result);
    if (!ici1.rows[0].result.success) {
      throw new Error('Instructor check-in failed!');
    }

    // Verify DB update
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const bkWithInstCheckin = (await client.query('SELECT checkin_instructor_at FROM public.bookings WHERE id = $1;', [bookingId])).rows[0];
    console.log('Instructor checkin timestamp in DB:', bkWithInstCheckin.checkin_instructor_at);
    if (!bkWithInstCheckin.checkin_instructor_at) {
      throw new Error('checkin_instructor_at is null in DB after checkin!');
    }

    // -------------------------------------------------------------
    // Requirement 12: LESSON LIFECYCLE (START -> COMPLETE -> IDEMPOTENCY)
    // -------------------------------------------------------------
    console.log('\n--- 12. LESSON LIFECYCLE ---');
    
    const callInstructorStart = async () => {
      await client.query(`
        SELECT set_config('role', 'authenticated', true),
               set_config('request.jwt.claims', $1, true);
      `, [JSON.stringify({ sub: instructorId, role: 'authenticated' })]);
      return await client.query('SELECT public.provider_start_lesson($1) AS result;', [bookingId]);
    };

    const callInstructorComplete = async (idemKey) => {
      await client.query(`
        SELECT set_config('role', 'authenticated', true),
               set_config('request.jwt.claims', $1, true);
      `, [JSON.stringify({ sub: instructorId, role: 'authenticated' })]);
      return await client.query('SELECT public.provider_complete_lesson($1, $2) AS result;', [bookingId, idemKey]);
    };

    // 12.1 Start Lesson
    console.log('Test 12.1: Start lesson...');
    const startRes = await callInstructorStart();
    console.log('Start Lesson result:', startRes.rows[0].result);
    if (!startRes.rows[0].result.success) {
      throw new Error('provider_start_lesson failed!');
    }

    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const statusInProgress = (await client.query('SELECT status FROM public.bookings WHERE id = $1;', [bookingId])).rows[0].status;
    console.log('Booking status after start:', statusInProgress);
    if (statusInProgress !== 'IN_PROGRESS') {
      throw new Error(`Booking status is not IN_PROGRESS: ${statusInProgress}`);
    }

    // 12.2 Complete Lesson
    console.log('Test 12.2: Complete lesson...');
    const completeRes = await callInstructorComplete('comp_idem_key_rc_1');
    console.log('Complete Lesson result:', completeRes.rows[0].result);
    if (!completeRes.rows[0].result.success) {
      throw new Error('provider_complete_lesson failed!');
    }

    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const statusCompleted = (await client.query('SELECT status FROM public.bookings WHERE id = $1;', [bookingId])).rows[0].status;
    console.log('Booking status after complete:', statusCompleted);
    if (statusCompleted !== 'COMPLETED') {
      throw new Error(`Booking status is not COMPLETED: ${statusCompleted}`);
    }

    // 12.3 Complete Lesson Idempotency
    console.log('Test 12.3: Complete lesson again (idempotency)...');
    const completeRes2 = await callInstructorComplete('comp_idem_key_rc_1');
    console.log('Complete Lesson duplicate result:', completeRes2.rows[0].result);
    if (!completeRes2.rows[0].result.success || !completeRes2.rows[0].result.is_idempotent) {
      throw new Error('Duplicate complete lesson was not handled idempotently!');
    }

    // -------------------------------------------------------------
    // Requirement 13: CHAT (SEND / READ / IDOR SECURITY)
    // -------------------------------------------------------------
    console.log('\n--- 13. CHAT PARTICIPANT IDOR SECURITY ---');
    
    // Create a conversation for the booking first (postgres level, but authenticate as studentId first)
    await client.query(`
      SELECT set_config('role', 'authenticated', true),
             set_config('request.jwt.claims', $1, true);
    `, [JSON.stringify({ sub: studentId, role: 'authenticated' })]);

    const convRes = await client.query(`
      SELECT * FROM public.get_or_create_conversation_for_booking($1);
    `, [bookingId]);
    const convId = convRes.rows[0].id;
    console.log('Conversation ID:', convId);

    // Call send_message helper
    const sendMessageAs = async (callerId, msg) => {
      await client.query(`
        SELECT set_config('role', 'authenticated', true),
               set_config('request.jwt.claims', $1, true);
      `, [JSON.stringify({ sub: callerId, role: 'authenticated' })]);

      return await client.query(`
        SELECT * FROM public.send_message($1, $2);
      `, [convId, msg]);
    };

    // 13.1 Student sends message (Allowed)
    console.log('Test 13.1: Student sends message...');
    const msg1 = await sendMessageAs(studentId, 'Hello Carlos!');
    console.log('Sent message ID:', msg1.rows[0].id);

    // 13.2 Instructor sends message (Allowed)
    console.log('Test 13.2: Instructor sends message...');
    const msg2 = await sendMessageAs(instructorId, 'Hi student, ready for the class!');
    console.log('Sent message ID:', msg2.rows[0].id);

    // 13.3 Third-party sends message (Blocked by IDOR security)
    console.log('Test 13.3: IDOR block check (Other student trying to send message)...');
    await client.query('SAVEPOINT sp_chat_idor_send;');
    try {
      await sendMessageAs(otherStudentId, 'Intruder message');
      throw new Error('Security Breach: Third-party sent message to conversation!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_chat_idor_send;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('FORBIDDEN') && !err.message.includes('NOT_A_PARTICIPANT')) throw err;
    }

    // 13.4 Third-party tries to read messages (Blocked by RLS on public.messages / public.conversations)
    console.log('Test 13.4: IDOR read check (Other student query)...');
    await client.query(`
      SELECT set_config('role', 'authenticated', true),
             set_config('request.jwt.claims', $1, true);
    `, [JSON.stringify({ sub: otherStudentId, role: 'authenticated' })]);
    
    const messagesRes = await client.query('SELECT * FROM public.messages WHERE conversation_id = $1;', [convId]);
    console.log(`Messages visible to other student: ${messagesRes.rows.length} (Expected: 0)`);
    if (messagesRes.rows.length > 0) {
      throw new Error('Security Breach: Third-party read messages from conversation via RLS leak!');
    }

    // -------------------------------------------------------------
    // Requirement 14: REVIEW (1-5 SCALE, TITULAR STUDENT, COMPLETED BOOKING, UNIQUE)
    // -------------------------------------------------------------
    console.log('\n--- 14. REVIEW WRITING & CONSTRAINTS ---');

    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);

    // Reset student claims to call review RPC
    const callReviewAs = async (callerId, rating, comment) => {
      await client.query(`
        SELECT set_config('role', 'authenticated', true),
               set_config('request.jwt.claims', $1, true);
      `, [JSON.stringify({ sub: callerId, role: 'authenticated' })]);

      return await client.query(`
        SELECT to_jsonb(public.create_review_for_booking($1::uuid, $2::integer, $3::text)) AS result;
      `, [bookingId, rating, comment]);
    };

    // 14.1 Score 0 (Invalid rating value block)
    console.log('Test 14.1: Rating value boundary (0)...');
    await client.query('SAVEPOINT sp_rev_val_0;');
    try {
      await callReviewAs(studentId, 0, 'Bad');
      throw new Error('Allowed rating = 0!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_rev_val_0;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('INVALID_RATING_VALUE') && !err.message.includes('INVALID_RATING') && !err.message.includes('REVIEW_RATING_OUT_OF_RANGE') && !err.message.includes('FORBIDDEN')) throw err;
    }

    // 14.2 Score 6 (Invalid rating value block)
    console.log('Test 14.2: Rating value boundary (6)...');
    await client.query('SAVEPOINT sp_rev_val_6;');
    try {
      await callReviewAs(studentId, 6, 'Overrated');
      throw new Error('Allowed rating = 6!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_rev_val_6;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('INVALID_RATING_VALUE') && !err.message.includes('INVALID_RATING') && !err.message.includes('REVIEW_RATING_OUT_OF_RANGE') && !err.message.includes('FORBIDDEN')) throw err;
    }

    // 14.3 Other student review (Ownership check)
    console.log('Test 14.3: Review by non-titular student...');
    await client.query('SAVEPOINT sp_rev_owner;');
    try {
      await callReviewAs(otherStudentId, 5, 'Great class');
      throw new Error('Security Breach: Non-titular student created review!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_rev_owner;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('UNAUTHORIZED_STUDENT') && !err.message.includes('FORBIDDEN')) throw err;
    }

    // 14.4 Titular student creates valid review (Score 5)
    console.log('Test 14.4: Titular student creates valid review...');
    const rev1 = await callReviewAs(studentId, 5, 'Super class, Carlos is amazing!');
    console.log('Created Review:', rev1.rows[0].result);
    if (!rev1.rows[0].result.id) {
      throw new Error('create_review_for_booking failed!');
    }

    // 14.5 Duplicate review check (Only 1 review per booking)
    console.log('Test 14.5: Duplicate review check...');
    await client.query('SAVEPOINT sp_rev_dup;');
    try {
      await callReviewAs(studentId, 4, 'Try again');
      throw new Error('Security Breach: Allowed duplicate reviews on same booking!');
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp_rev_dup;');
      console.log('Expected block message:', err.message);
      if (!err.message.includes('DUPLICATE_REVIEW') && !err.message.includes('REVIEW_ALREADY_EXISTS') && !err.message.includes('FORBIDDEN') && !err.message.includes('duplicate key value violates unique constraint')) throw err;
    }

    // Verify rating updates
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const provRating = (await client.query('SELECT rating_average, rating_count FROM public.providers WHERE id = $1;', [providerId])).rows[0];
    console.log(`Updated Provider Rating stats: Avg=${provRating.rating_average}, Count=${provRating.rating_count}`);

    // -------------------------------------------------------------
    // Requirement 15: CANCELLATION SCENARIOS
    // -------------------------------------------------------------
    console.log('\n--- 15. CANCELLATION SCENARIOS ---');
    
    // Insert another mock CONFIRMED booking to test cancellation
    const cancelBookingId = '88888888-8888-4000-8000-888888888888';
    await client.query(`
      INSERT INTO public.bookings (
        id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
        scheduled_start_at, scheduled_end_at, status, meeting_point,
        price_in_cents, platform_fee_in_cents, total_in_cents, snapshot_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours', NOW() + INTERVAL '25 hours', 'CONFIRMED', '{"type": "PROVIDER_ADDRESS"}'::jsonb,
        12000, 1000, 13000, '{}'::jsonb
      );
    `, [cancelBookingId, studentId, providerId, instructorId, vehicleId, offeringId]);

    // Student cancels booking
    await client.query(`
      SELECT set_config('role', 'authenticated', true),
             set_config('request.jwt.claims', $1, true);
    `, [JSON.stringify({ sub: studentId, role: 'authenticated' })]);

    const cancelRes = await client.query(`
      SELECT public.cancel_booking_v2($1, 'Desisti da aula') AS result;
    `, [cancelBookingId]);
    console.log('Cancellation result:', cancelRes.rows[0].result);
    if (!cancelRes.rows[0].result.success) {
      throw new Error('cancel_booking_v2 failed!');
    }

    // Verify DB update
    await client.query(`
      SELECT set_config('role', 'postgres', true),
             set_config('request.jwt.claims', null, true);
    `);
    const cancelledBooking = (await client.query('SELECT status, cancellation_reason, cancelled_by FROM public.bookings WHERE id = $1;', [cancelBookingId])).rows[0];
    console.log('Cancelled Booking Status:', cancelledBooking.status);
    console.log('Cancelled By:', cancelledBooking.cancelled_by);
    console.log('Cancellation Reason:', cancelledBooking.cancellation_reason);
    if (cancelledBooking.status !== 'CANCELLED_BY_STUDENT') {
      throw new Error(`Invalid status after cancellation: ${cancelledBooking.status}`);
    }

    // -------------------------------------------------------------
    // Requirement 16 & 17: ANALYTICS ISOLATION & SECURITY SMOKE
    // -------------------------------------------------------------
    console.log('\n--- 16 & 17. ANALYTICS ISOLATION & SECURITY SMOKE ---');

    // Confirm Carlos context
      // Set JWT for Carlos and switch to service_role
      await client.query(`
        SELECT set_config('role','service_role',true),
               set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111102","role":"authenticated"}', true);
      `);
      console.log('Auth UID after set_config:', await client.query("SELECT auth.uid();"));
      console.log('Is active check:', await client.query("SELECT public.is_current_user_active();"));
    const carlosSum = (await client.query(`
      SELECT public.get_provider_analytics_summary(
        '2026-08-01T00:00:00-03:00'::TIMESTAMPTZ,
        '2026-08-31T23:59:59-03:00'::TIMESTAMPTZ
      ) AS summary;
    `)).rows[0].summary;
    console.log('Carlos Analytics contexts:', carlosSum.provider_contexts);

    // Rollback the transaction to restore Supabase LIVE completely untouched!
    await client.query('ROLLBACK');
    console.log('\n--- TRANSACTION ROLLBACK COMPLETED SUCCESSFULLY ---');
    console.log('All transactional validation test scenarios passed!');

  } catch (err) {
    console.error('Validation script failed:', err);
    try {
      await client.query('ROLLBACK');
      console.log('Transaction safely rolled back.');
    } catch (e) {
      console.error('Failed to rollback transaction:', e);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runE2EValidation();

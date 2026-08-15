// ============================================================================
// MAZZI PLATFORM — SPRINT 09 REAL DATABASE EXECUTION GATE
// ============================================================================

import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function runSprint09RealDatabaseGate() {
  console.log('================================================================');
  console.log('MAZZI PLATFORM — SPRINT 09 REAL DATABASE EXECUTION GATE');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------
    // GATE 1: SCHEMA MIGRATIONS 01 - 10
    // -------------------------------------------------------------
    console.log('[GATE 1] Running all migrations 000001 - 000010 on clean schema...');
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);

    const migrationFiles = [
      '20260814000001_initial_schema.sql',
      '20260814000002_auth_rbac.sql',
      '20260814000003_auth_security_hardening.sql',
      '20260814000004_providers_compliance.sql',
      '20260814000005_compliance_regulatory_hardening.sql',
      '20260814000006_vehicles_offerings.sql',
      '20260814000007_availability_scheduling.sql',
      '20260814000008_search_postgis.sql',
      '20260815000009_quote_booking.sql',
      '20260815000010_payments_commission_payout.sql',
    ];

    for (const f of migrationFiles) {
      const sql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', f), 'utf-8');
      await client.query(sql);
    }

    const seedSql = fs.readFileSync(path.join(process.cwd(), 'supabase', 'seed.sql'), 'utf-8');
    await client.query(seedSql);
    console.log('Migrations & Seed executed successfully! [PASS]\n');

    // -------------------------------------------------------------
    // GATE 2: PROVIDER PAYMENT ACCOUNTS & LEDGER
    // -------------------------------------------------------------
    console.log('[GATE 2] Testing Provider Payment Account & Constraints...');
    const provRes = await client.query('SELECT id FROM providers LIMIT 1;');
    const providerId = provRes.rows[0].id;
    const studentRes = await client.query("SELECT id FROM users WHERE role = 'STUDENT' LIMIT 1;");
    const studentId = studentRes.rows[0].id;

    await client.query(`
      INSERT INTO provider_payment_accounts (
        provider_id, gateway, external_account_id, status, charges_enabled, payouts_enabled
      ) VALUES (
        $1, 'MERCADOPAGO', 'mp_seller_test_123', 'ACTIVE', true, true
      );
    `, [providerId]);
    console.log('Provider Payment Account created! [PASS]');

    // -------------------------------------------------------------
    // GATE 3: CREATE BOOKING HOLD & PAYMENT
    // -------------------------------------------------------------
    console.log('[GATE 3] Testing Booking Hold & Payment Initiation...');
    // Create a quote first
    const qRes = await client.query(`
      INSERT INTO quotes (
        student_id, provider_id, offering_id, instructor_id, vehicle_id,
        scheduled_start_at, scheduled_end_at,
        price_in_cents, platform_fee_in_cents, total_in_cents, expires_at, status
      ) VALUES (
        $1, $2, (SELECT id FROM service_offerings LIMIT 1),
        (SELECT user_id FROM providers WHERE id = $2),
        (SELECT id FROM vehicles WHERE provider_id = $2 LIMIT 1),
        '2026-09-20T10:00:00Z', '2026-09-20T10:50:00Z',
        10000, 1000, 11000, NOW() + INTERVAL '10 minutes', 'ACTIVE'
      ) RETURNING id;
    `, [studentId, providerId]);
    const quoteId = qRes.rows[0].id;

    // Call create_booking_hold
    const holdRes = await client.query(`
      SELECT create_booking_hold(
        $1, $2, 'idem_pay_test_01', 10
      ) AS hold;
    `, [quoteId, studentId]);
    const bookingId = holdRes.rows[0].hold.booking_id;
    console.log('Booking Hold created:', bookingId, '[PASS]');

    // Insert payment record
    const payRes = await client.query(`
      INSERT INTO payments (
        booking_id, student_id, provider_id, method, status, amount_in_cents,
        platform_fee_in_cents, provider_amount_in_cents, external_transaction_id,
        idempotency_key, gateway_provider
      ) VALUES (
        $1, $2, $3, 'PIX', 'PENDING', 11000, 1000, 10000, 'mp_pay_ext_999',
        'idem_payment_key_01', 'MERCADOPAGO'
      ) RETURNING id;
    `, [bookingId, studentId, providerId]);
    const paymentId = payRes.rows[0].id;
    console.log('Payment inserted:', paymentId, '[PASS]');

    // -------------------------------------------------------------
    // GATE 4: ATOMIC CONFIRMATION FUNCTION (confirm_booking_payment)
    // -------------------------------------------------------------
    console.log('[GATE 4] Testing confirm_booking_payment atomic transaction...');
    const confirmRes1 = await client.query(`
      SELECT confirm_booking_payment($1, 'mp_pay_ext_999', NOW()) AS res;
    `, [paymentId]);
    console.log('Confirmation result 1:', confirmRes1.rows[0].res);

    if (confirmRes1.rows[0].res.status !== 'CONFIRMED' || confirmRes1.rows[0].res.already_paid !== false) {
      throw new Error('Falha na primeira confirmação do pagamento.');
    }

    // Verify booking and payment status in DB
    const bCheck = await client.query('SELECT status, confirmed_at FROM bookings WHERE id = $1', [bookingId]);
    const pCheck = await client.query('SELECT status, paid_at FROM payments WHERE id = $1', [paymentId]);
    if (bCheck.rows[0].status !== 'CONFIRMED' || pCheck.rows[0].status !== 'PAID') {
      throw new Error(`DB state mismatch: booking=${bCheck.rows[0].status}, payment=${pCheck.rows[0].status}`);
    }

    // Check financial events recorded in ledger
    const feRes = await client.query('SELECT event_type, amount_in_cents FROM financial_events WHERE booking_id = $1', [bookingId]);
    console.log('Financial Events recorded:', feRes.rows);
    if (feRes.rows.length !== 3) {
      throw new Error(`Esperado 3 eventos financeiros no ledger, encontrado ${feRes.rows.length}`);
    }
    console.log('Atomic Confirmation & Ledger [PASS]\n');

    // -------------------------------------------------------------
    // GATE 5: IDEMPOTENCY REPLAY TEST
    // -------------------------------------------------------------
    console.log('[GATE 5] Testing Idempotent Replay on confirm_booking_payment...');
    const confirmRes2 = await client.query(`
      SELECT confirm_booking_payment($1, 'mp_pay_ext_999', NOW()) AS res;
    `, [paymentId]);
    console.log('Confirmation result 2 (Replay):', confirmRes2.rows[0].res);

    if (confirmRes2.rows[0].res.already_paid !== true) {
      throw new Error('Replay de confirmação de pagamento não retornou already_paid = true');
    }

    const feCountAfter = await client.query('SELECT COUNT(*) FROM financial_events WHERE booking_id = $1', [bookingId]);
    if (parseInt(feCountAfter.rows[0].count) !== 3) {
      throw new Error('Replay gerou eventos duplicados no ledger!');
    }
    console.log('Idempotent Replay [PASS]\n');

    // -------------------------------------------------------------
    // GATE 6: LATE PAYMENT ON EXPIRED BOOKING DEFENSE
    // -------------------------------------------------------------
    console.log('[GATE 6] Testing Late Payment on Expired Booking Defense...');
    // Create an expired booking
    const expBookRes = await client.query(`
      INSERT INTO bookings (
        student_id, provider_id, instructor_id, vehicle_id, offering_id,
        scheduled_start_at, scheduled_end_at,
        status, price_in_cents, platform_fee_in_cents, total_in_cents, meeting_point, snapshot_data
      ) VALUES (
        $1, $2, (SELECT user_id FROM providers WHERE id = $2),
        (SELECT id FROM vehicles WHERE provider_id = $2 LIMIT 1),
        (SELECT id FROM service_offerings LIMIT 1),
        '2026-09-21T14:00:00Z', '2026-09-21T14:50:00Z',
        'EXPIRED', 10000, 1000, 11000, '{"name": "Meeting Point"}'::jsonb, '{}'::jsonb
      ) RETURNING id;
    `, [studentId, providerId]);
    const expiredBookingId = expBookRes.rows[0].id;

    const expPayRes = await client.query(`
      INSERT INTO payments (
        booking_id, student_id, provider_id, method, status, amount_in_cents,
        platform_fee_in_cents, provider_amount_in_cents, external_transaction_id,
        idempotency_key, gateway_provider
      ) VALUES (
        $1, $2, $3, 'PIX', 'PENDING', 11000, 1000, 10000, 'mp_pay_late_123',
        'idem_late_pay', 'MERCADOPAGO'
      ) RETURNING id;
    `, [expiredBookingId, studentId, providerId]);
    const latePaymentId = expPayRes.rows[0].id;

    const lateConfirmRes = await client.query(`
      SELECT confirm_booking_payment($1, 'mp_pay_late_123', NOW()) AS res;
    `, [latePaymentId]);
    console.log('Late confirmation response:', lateConfirmRes.rows[0].res);

    if (lateConfirmRes.rows[0].res.is_late_payment !== true || lateConfirmRes.rows[0].res.refund_pending !== true) {
      throw new Error('Late payment did not flag is_late_payment / refund_pending properly!');
    }

    // Verify booking did NOT revive to CONFIRMED
    const checkExpBook = await client.query('SELECT status FROM bookings WHERE id = $1', [expiredBookingId]);
    if (checkExpBook.rows[0].status !== 'EXPIRED') {
      throw new Error(`Expired booking was revived to ${checkExpBook.rows[0].status}`);
    }
    console.log('Late Payment on Expired Booking Defense [PASS]\n');

    // -------------------------------------------------------------
    // GATE 7: ATOMIC REFUND FUNCTION (process_booking_refund)
    // -------------------------------------------------------------
    console.log('[GATE 7] Testing process_booking_refund atomic transaction...');
    // 1. Partial refund of 5000 cents on payment 1 (total 11000 cents)
    const partialRefRes = await client.query(`
      SELECT process_booking_refund(
        $1, 5000, 'Cancelamento Parcial Estudante', 'idem_ref_partial_01', 'mp_ref_ext_01'
      ) AS res;
    `, [paymentId]);
    console.log('Partial refund result:', partialRefRes.rows[0].res);

    if (partialRefRes.rows[0].res.is_full_refund !== false) {
      throw new Error('Partial refund returned is_full_refund = true');
    }

    // Verify status
    const bPartCheck = await client.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
    if (bPartCheck.rows[0].status !== 'PARTIALLY_REFUNDED') {
      throw new Error(`Booking status mismatch after partial refund: ${bPartCheck.rows[0].status}`);
    }

    // 2. Excess refund attempt (attempting 7000 when only 6000 remains)
    let excessCaught = false;
    try {
      await client.query(`
        SELECT process_booking_refund(
          $1, 7000, 'Tentativa Excesso', 'idem_ref_excess', 'mp_ref_ext_err'
        );
      `, [paymentId]);
    } catch (err: any) {
      excessCaught = true;
      console.log('Excess refund properly blocked by PostgreSQL [PASS]:', err.message);
    }
    if (!excessCaught) {
      throw new Error('Excess refund was not blocked by PostgreSQL constraint!');
    }

    // 3. Final refund of remaining 6000 cents
    const fullRefRes = await client.query(`
      SELECT process_booking_refund(
        $1, 6000, 'Restante Reembolso', 'idem_ref_full_02', 'mp_ref_ext_02'
      ) AS res;
    `, [paymentId]);
    console.log('Full refund result:', fullRefRes.rows[0].res);

    if (fullRefRes.rows[0].res.is_full_refund !== true) {
      throw new Error('Final refund did not mark is_full_refund = true');
    }

    const bFullCheck = await client.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
    const pFullCheck = await client.query('SELECT status FROM payments WHERE id = $1', [paymentId]);
    if (bFullCheck.rows[0].status !== 'REFUNDED' || pFullCheck.rows[0].status !== 'REFUNDED') {
      throw new Error(`Status mismatch after full refund: booking=${bFullCheck.rows[0].status}, payment=${pFullCheck.rows[0].status}`);
    }

    // 4. Refund Idempotency Replay
    const replayRefRes = await client.query(`
      SELECT process_booking_refund(
        $1, 6000, 'Restante Reembolso', 'idem_ref_full_02', 'mp_ref_ext_02'
      ) AS res;
    `, [paymentId]);
    if (replayRefRes.rows[0].res.is_existing !== true) {
      throw new Error('Refund idempotency replay did not return is_existing = true');
    }
    console.log('Atomic Refunds & Policy Safeguards [PASS]\n');

    // -------------------------------------------------------------
    // GATE 8: CONCURRENT DOUBLE-PAYMENT RACE CONDITIONS
    // -------------------------------------------------------------
    console.log('[GATE 8] Testing High Concurrency Double-Payment Race Condition...');
    // Create new booking & payment
    const concQuoteRes = await client.query(`
      INSERT INTO quotes (
        student_id, provider_id, offering_id, instructor_id, vehicle_id,
        scheduled_start_at, scheduled_end_at,
        price_in_cents, platform_fee_in_cents, total_in_cents, expires_at, status
      ) VALUES (
        $1, $2, (SELECT id FROM service_offerings LIMIT 1),
        (SELECT user_id FROM providers WHERE id = $2),
        (SELECT id FROM vehicles WHERE provider_id = $2 LIMIT 1),
        '2026-09-22T16:00:00Z', '2026-09-22T16:50:00Z',
        10000, 1000, 11000, NOW() + INTERVAL '10 minutes', 'ACTIVE'
      ) RETURNING id;
    `, [studentId, providerId]);

    const concHoldRes = await client.query(`
      SELECT create_booking_hold($1, $2, 'idem_conc_pay_hold', 10) AS hold;
    `, [concQuoteRes.rows[0].id, studentId]);
    const concBookingId = concHoldRes.rows[0].hold.booking_id;

    const concPayRes = await client.query(`
      INSERT INTO payments (
        booking_id, student_id, provider_id, method, status, amount_in_cents,
        platform_fee_in_cents, provider_amount_in_cents, external_transaction_id,
        idempotency_key, gateway_provider
      ) VALUES (
        $1, $2, $3, 'PIX', 'PENDING', 11000, 1000, 10000, 'mp_pay_conc_999',
        'idem_conc_pay', 'MERCADOPAGO'
      ) RETURNING id;
    `, [concBookingId, studentId, providerId]);
    const concPaymentId = concPayRes.rows[0].id;

    // Send 10 concurrent confirmation requests
    const promises = Array.from({ length: 10 }).map((_, i) =>
      pool.query('SELECT confirm_booking_payment($1, $2, NOW()) AS res;', [concPaymentId, `ext_tx_${i}`])
    );

    const concResults = await Promise.all(promises);
    let firstConfirmedCount = 0;
    let alreadyPaidCount = 0;

    for (const r of concResults) {
      if (r.rows[0].res.already_paid === false && r.rows[0].res.status === 'CONFIRMED') {
        firstConfirmedCount++;
      } else if (r.rows[0].res.already_paid === true) {
        alreadyPaidCount++;
      }
    }

    console.log(`Concurrent executions: ${firstConfirmedCount} first-time confirmed, ${alreadyPaidCount} safely recognized as already paid.`);
    if (firstConfirmedCount !== 1 || alreadyPaidCount !== 9) {
      throw new Error(`Concorrência violada! firstConfirmed=${firstConfirmedCount}, alreadyPaid=${alreadyPaidCount}`);
    }
    console.log('Concurrent Double-Payment Defense [PASS]\n');

    console.log('================================================================');
    console.log('ALL SPRINT 09 REAL DATABASE GATES PASSED (100% SUCCESS)');
    console.log('================================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runSprint09RealDatabaseGate().catch((err) => {
  console.error('SPRINT 09 GATE FAILED:', err);
  process.exit(1);
});

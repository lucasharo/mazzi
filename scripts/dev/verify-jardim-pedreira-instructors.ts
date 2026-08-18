import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const devPassword =
  process.env.VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD ||
  process.env.MAZZI_DEV_DEMO_PASSWORD ||
  'teste123';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  console.log('=== VERIFYING JARDIM DA PEDREIRA INSTRUCTORS ===');

  const emails = [
    'instrutor09@mazzi.com.br',
    'instrutor10@mazzi.com.br',
    'instrutor11@mazzi.com.br',
    'instrutor12@mazzi.com.br',
    'instrutor13@mazzi.com.br',
    'instrutor14@mazzi.com.br',
  ];

  // 1. Verify Real Supabase Auth Login
  console.log('\n--- 1. SUPABASE AUTH REAL LOGIN VERIFICATION ---');
  let authSuccessCount = 0;

  for (const email of emails) {
    const client = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: devPassword,
    });

    if (error || !data.session) {
      console.error(`[FAIL] Login failed for ${email}:`, error?.message);
    } else {
      console.log(`[PASS] Real login SUCCESS for ${email} (User ID: ${data.session.user.id})`);
      authSuccessCount++;
      await client.auth.signOut();
    }
  }

  console.log(`Auth verification: ${authSuccessCount}/${emails.length} LOGIN PASS.`);

  // 2. Verify Database Entities Integrity
  console.log('\n--- 2. DATABASE ENTITIES INTEGRITY ---');
  const countRes = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM public.users WHERE email IN (${emails.map((_, i) => `$${i + 1}`).join(',')})) as users_count,
       (SELECT COUNT(*) FROM public.providers WHERE trade_name LIKE '%Jardim da Pedreira%') as providers_count,
       (SELECT COUNT(*) FROM public.vehicles WHERE license_plate IN ('RFM9I09','JLA1J10','BNS1K11','CML1L12','LND1M13','VNS1N14')) as vehicles_count,
       (SELECT COUNT(*) FROM public.service_offerings o JOIN public.providers p ON p.id = o.provider_id WHERE p.trade_name LIKE '%Jardim da Pedreira%') as offerings_count,
       (SELECT COUNT(*) FROM public.availabilities a JOIN public.providers p ON p.id = a.provider_id WHERE p.trade_name LIKE '%Jardim da Pedreira%') as availabilities_count`,
    emails
  );

  console.table(countRes.rows[0]);

  // 3. Verify Real Public Search (Jardim da Pedreira: -23.693, -46.685)
  console.log('\n--- 3. STUDENT REAL PUBLIC SEARCH VERIFICATION ---');
  const searchClient = createClient(supabaseUrl!, anonKey!);
  const { data: searchResults, error: searchError } = await searchClient.rpc(
    'search_providers_public',
    {
      p_user_lat: -23.693,
      p_user_lng: -46.685,
      p_radius_meters: 10000,
      p_category: 'B',
      p_provider_type: 'INSTRUCTOR',
    }
  );

  if (searchError) {
    console.error('[FAIL] search_providers_public error:', searchError);
  } else {
    console.log(`Found ${searchResults?.length} total instructors near Jardim da Pedreira.`);
    if (searchResults && searchResults.length > 0) {
      console.log('Sample result keys:', Object.keys(searchResults[0]));
    }
    const foundNewInstructors = searchResults?.filter((r: any) =>
      JSON.stringify(r).includes('Jardim da Pedreira')
    );

    console.log(`New Jardim da Pedreira instructors returned: ${foundNewInstructors?.length}`);
    for (const item of foundNewInstructors || []) {
      const name = item.trade_name || item.name || item.tradeName || 'Instructor';
      const dist = item.distance_formatted || item.distance_km || item.distance_meters || 'N/A';
      const price = item.starting_price_in_cents ? `R$ ${(item.starting_price_in_cents / 100).toFixed(2)}` : 'N/A';
      console.log(`  - ${name} | Distance: ${dist} | Price: ${price}`);
    }
  }

  // 4. Verify Quote Creation for one of the new instructors
  console.log('\n--- 4. QUOTE CREATION VERIFICATION ---');
  const offeringRes = await pool.query(
    `SELECT o.id as offering_id, o.provider_id, o.instructor_id
     FROM public.service_offerings o
     JOIN public.providers p ON p.id = o.provider_id
     WHERE p.trade_name LIKE '%Jardim da Pedreira%'
     LIMIT 1`
  );

  if (offeringRes.rows.length > 0) {
    const row = offeringRes.rows[0];
    const idempotencyKey = `verification-quote-pedreira-${Date.now()}`;
    const nextMonday = new Date();
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
    nextMonday.setHours(8, 0, 0, 0);
    const slotStart = nextMonday.toISOString();

    const studentClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: studentAuthErr } = await studentClient.auth.signInWithPassword({
      email: 'aluno01@mazzi.com.br',
      password: devPassword,
    });

    if (studentAuthErr) {
      console.error('[FAIL] Could not authenticate student for quote check:', studentAuthErr.message);
    } else {
      const { data: quoteData, error: quoteRpcErr } = await studentClient.rpc(
        'create_quote_from_offering',
        {
          p_offering_id: row.offering_id,
          p_scheduled_start_at: slotStart,
          p_idempotency_key: idempotencyKey,
        }
      );

      if (quoteRpcErr) {
        console.error('[FAIL] create_quote_from_offering RPC error:', quoteRpcErr);
      } else {
        const q = Array.isArray(quoteData) ? quoteData[0] : quoteData;
        console.log('[PASS] Quote created successfully via RPC:', {
          quote_id: q?.quote_id || q?.id,
          is_idempotent: q?.is_idempotent,
          price_in_cents: q?.price_in_cents,
        });
      }
    }
  }

  await pool.end();
  console.log('=== VERIFICATION COMPLETE ===');
}

verify().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});

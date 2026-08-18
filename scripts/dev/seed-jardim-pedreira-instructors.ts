import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const devPassword =
  process.env.VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD ||
  process.env.MAZZI_DEV_DEMO_PASSWORD;

if (!supabaseUrl || !serviceKey || !databaseUrl || !devPassword) {
  console.error('REQUIRED ENVIRONMENT VARIABLES MISSING FOR SEEDER: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, or devPassword');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export interface InstructorSeedSpec {
  index: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birth_date: string;
  trade_name: string;
  neighborhood: string;
  city: string;
  state: string;
  service_radius_km: number;
  lat: number;
  lng: number;
  vehicle: {
    brand: string;
    model: string;
    year: number;
    plate: string;
    transmission: 'MANUAL' | 'AUTOMATIC';
  };
  price_cents: number;
}

export const NEW_INSTRUCTORS_SPEC: InstructorSeedSpec[] = [
  {
    index: '09',
    name: 'Rafael Martins',
    email: 'instrutor09@mazzi.com.br',
    phone: '(11) 99009-0009',
    cpf: '11122233396',
    birth_date: '1990-05-15',
    trade_name: 'Instrutor Rafael - Jardim da Pedreira',
    neighborhood: 'Jardim da Pedreira',
    city: 'São Paulo',
    state: 'SP',
    service_radius_km: 10,
    lat: -23.6925,
    lng: -46.6861,
    vehicle: {
      brand: 'Chevrolet',
      model: 'Onix',
      year: 2023,
      plate: 'RFM9I09',
      transmission: 'MANUAL',
    },
    price_cents: 9500,
  },
  {
    index: '10',
    name: 'Juliana Alves',
    email: 'instrutor10@mazzi.com.br',
    phone: '(11) 99010-0010',
    cpf: '22233344422',
    birth_date: '1992-08-20',
    trade_name: 'Instrutora Juliana - Jardim da Pedreira',
    neighborhood: 'Jardim da Pedreira',
    city: 'São Paulo',
    state: 'SP',
    service_radius_km: 10,
    lat: -23.6948,
    lng: -46.6823,
    vehicle: {
      brand: 'Hyundai',
      model: 'HB20',
      year: 2024,
      plate: 'JLA1J10',
      transmission: 'AUTOMATIC',
    },
    price_cents: 11000,
  },
  {
    index: '11',
    name: 'Bruno Santos',
    email: 'instrutor11@mazzi.com.br',
    phone: '(11) 99011-0011',
    cpf: '33344455587',
    birth_date: '1988-11-10',
    trade_name: 'Instrutor Bruno - Jardim da Pedreira',
    neighborhood: 'Jardim da Pedreira',
    city: 'São Paulo',
    state: 'SP',
    service_radius_km: 10,
    lat: -23.6912,
    lng: -46.6845,
    vehicle: {
      brand: 'Fiat',
      model: 'Argo',
      year: 2023,
      plate: 'BNS1K11',
      transmission: 'MANUAL',
    },
    price_cents: 10000,
  },
  {
    index: '12',
    name: 'Camila Ferreira',
    email: 'instrutor12@mazzi.com.br',
    phone: '(11) 99012-0012',
    cpf: '44455566671',
    birth_date: '1994-03-25',
    trade_name: 'Instrutora Camila - Jardim da Pedreira',
    neighborhood: 'Jardim da Pedreira',
    city: 'São Paulo',
    state: 'SP',
    service_radius_km: 10,
    lat: -23.689,
    lng: -46.688,
    vehicle: {
      brand: 'Volkswagen',
      model: 'Polo',
      year: 2024,
      plate: 'CML1L12',
      transmission: 'AUTOMATIC',
    },
    price_cents: 12000,
  },
  {
    index: '13',
    name: 'Leandro Costa',
    email: 'instrutor13@mazzi.com.br',
    phone: '(11) 99013-0013',
    cpf: '55566677730',
    birth_date: '1987-07-14',
    trade_name: 'Instrutor Leandro - Jardim da Pedreira',
    neighborhood: 'Jardim da Pedreira',
    city: 'São Paulo',
    state: 'SP',
    service_radius_km: 10,
    lat: -23.696,
    lng: -46.6872,
    vehicle: {
      brand: 'Renault',
      model: 'Kwid',
      year: 2023,
      plate: 'LND1M13',
      transmission: 'MANUAL',
    },
    price_cents: 9800,
  },
  {
    index: '14',
    name: 'Vanessa Oliveira',
    email: 'instrutor14@mazzi.com.br',
    phone: '(11) 99014-0014',
    cpf: '66677788889',
    birth_date: '1991-12-02',
    trade_name: 'Instrutora Vanessa - Jardim da Pedreira',
    neighborhood: 'Jardim da Pedreira',
    city: 'São Paulo',
    state: 'SP',
    service_radius_km: 10,
    lat: -23.6905,
    lng: -46.6815,
    vehicle: {
      brand: 'Toyota',
      model: 'Yaris',
      year: 2024,
      plate: 'VNS1N14',
      transmission: 'AUTOMATIC',
    },
    price_cents: 12500,
  },
];

export async function runSeeder() {
  console.log('=== STARTING SEEDER FOR JARDIM DA PEDREIRA INSTRUCTORS ===');

  // Fetch all auth users to check existing
  const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Failed to list Auth users: ${listError.message}`);
  }

  const existingAuthUsersMap = new Map<string, string>();
  for (const u of listData.users) {
    if (u.email) {
      existingAuthUsersMap.set(u.email.toLowerCase(), u.id);
    }
  }

  const summaryResults = [];

  for (const spec of NEW_INSTRUCTORS_SPEC) {
    const emailLower = spec.email.toLowerCase();
    let authUserId = existingAuthUsersMap.get(emailLower);

    if (!authUserId) {
      console.log(`[AUTH] Creating new Auth user for ${spec.email}...`);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: spec.email,
        password: devPassword,
        email_confirm: true,
        user_metadata: {
          name: spec.name,
          role: 'INSTRUCTOR',
        },
      });

      if (createError || !newUser.user) {
        throw new Error(`Failed to create Auth user ${spec.email}: ${createError?.message}`);
      }
      authUserId = newUser.user.id;
    } else {
      console.log(`[AUTH] User ${spec.email} exists (${authUserId}). Updating password & meta...`);
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        password: devPassword,
        email_confirm: true,
        user_metadata: {
          name: spec.name,
          role: 'INSTRUCTOR',
        },
      });
    }

    // 1. public.users
    await pool.query(
      `INSERT INTO public.users (id, email, name, role, status, phone, cpf, birth_date, created_at, updated_at)
       VALUES ($1, $2, $3, 'INSTRUCTOR', 'ACTIVE', $4, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = EXCLUDED.name,
         role = 'INSTRUCTOR',
         status = 'ACTIVE',
         phone = EXCLUDED.phone,
         cpf = EXCLUDED.cpf,
         birth_date = EXCLUDED.birth_date,
         updated_at = NOW()`,
      [authUserId, spec.email, spec.name, spec.phone, spec.cpf, spec.birth_date]
    );

    // 2. public.providers
    let providerId: string;
    const existingProv = await pool.query(`SELECT id FROM public.providers WHERE user_id = $1`, [authUserId]);
    if (existingProv.rows.length > 0) {
      providerId = existingProv.rows[0].id;
      await pool.query(
        `UPDATE public.providers
         SET type = 'INSTRUCTOR', status = 'ACTIVE', legal_name = $1, trade_name = $2, document_number = $3,
             neighborhood = $4, city = $5, state = $6, service_radius_km = $7, latitude = $8, longitude = $9,
             public_latitude = $8, public_longitude = $9, public_map_location_type = 'NEIGHBORHOOD_CENTROID', updated_at = NOW()
         WHERE id = $10`,
        [spec.name, spec.trade_name, spec.cpf, spec.neighborhood, spec.city, spec.state, spec.service_radius_km, spec.lat, spec.lng, providerId]
      );
    } else {
      const pRes = await pool.query(
        `INSERT INTO public.providers (
           user_id, type, status, legal_name, trade_name, document_number, neighborhood, city, state,
           service_radius_km, latitude, longitude, public_latitude, public_longitude,
           public_map_location_type, created_at, updated_at
         )
         VALUES ($1, 'INSTRUCTOR', 'ACTIVE', $2, $3, $4, $5, $6, $7, $8, $9, $10, $9, $10, 'NEIGHBORHOOD_CENTROID', NOW(), NOW())
         RETURNING id`,
        [authUserId, spec.name, spec.trade_name, spec.cpf, spec.neighborhood, spec.city, spec.state, spec.service_radius_km, spec.lat, spec.lng]
      );
      providerId = pRes.rows[0].id;
    }

    // PostGIS location update
    await pool.query(
      `UPDATE public.providers
       SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)
       WHERE id = $3`,
      [spec.lng, spec.lat, providerId]
    );

    // 3. public.vehicles
    let vehicleId: string;
    const existingVeh = await pool.query(
      `SELECT id FROM public.vehicles WHERE provider_id = $1 AND license_plate = $2`,
      [providerId, spec.vehicle.plate]
    );
    if (existingVeh.rows.length > 0) {
      vehicleId = existingVeh.rows[0].id;
      await pool.query(
        `UPDATE public.vehicles
         SET vehicle_type = 'CAR', category = 'B', status = 'ACTIVE', has_dual_pedal = true,
             brand = $1, model = $2, year = $3, transmission = $4, updated_at = NOW()
         WHERE id = $5`,
        [spec.vehicle.brand, spec.vehicle.model, spec.vehicle.year, spec.vehicle.transmission, vehicleId]
      );
    } else {
      const vRes = await pool.query(
        `INSERT INTO public.vehicles (
           provider_id, vehicle_type, category, status, has_dual_pedal,
           brand, model, year, license_plate, license_plate_masked, transmission, created_at, updated_at
         )
         VALUES ($1, 'CAR', 'B', 'ACTIVE', true, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [
          providerId,
          spec.vehicle.brand,
          spec.vehicle.model,
          spec.vehicle.year,
          spec.vehicle.plate,
          `***-${spec.vehicle.plate.slice(-4)}`,
          spec.vehicle.transmission,
        ]
      );
      vehicleId = vRes.rows[0].id;
    }

    // 4. public.service_offerings
    let offeringId: string;
    const existingOff = await pool.query(
      `SELECT id FROM public.service_offerings WHERE provider_id = $1 AND instructor_id = $2 AND category = 'B'`,
      [providerId, authUserId]
    );
    if (existingOff.rows.length > 0) {
      offeringId = existingOff.rows[0].id;
      await pool.query(
        `UPDATE public.service_offerings
         SET vehicle_id = $1, transmission = $2, duration_minutes = 50, price_in_cents = $3, is_active = true, status = 'ACTIVE', updated_at = NOW()
         WHERE id = $4`,
        [vehicleId, spec.vehicle.transmission, spec.price_cents, offeringId]
      );
    } else {
      const oRes = await pool.query(
        `INSERT INTO public.service_offerings (
           provider_id, instructor_id, vehicle_id, category, transmission,
           duration_minutes, price_in_cents, is_active, status, created_at, updated_at
         )
         VALUES ($1, $2, $3, 'B', $4, 50, $5, true, 'ACTIVE', NOW(), NOW())
         RETURNING id`,
        [providerId, authUserId, vehicleId, spec.vehicle.transmission, spec.price_cents]
      );
      offeringId = oRes.rows[0].id;
    }

    // 5. public.availabilities
    let availCount = 0;
    const days = [1, 2, 3, 4, 5, 6];
    for (const day of days) {
      const startTime = '08:00:00';
      const endTime = day === 6 ? '14:00:00' : '18:00:00';

      const existingAvail = await pool.query(
        `SELECT id FROM public.availabilities WHERE provider_id = $1 AND instructor_id = $2 AND day_of_week = $3 AND start_time = $4`,
        [providerId, authUserId, day, startTime]
      );

      if (existingAvail.rows.length > 0) {
        await pool.query(
          `UPDATE public.availabilities
           SET vehicle_id = $1, end_time = $2, timezone = 'America/Sao_Paulo', is_active = true, updated_at = NOW()
           WHERE id = $3`,
          [vehicleId, endTime, existingAvail.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO public.availabilities (
             provider_id, instructor_id, vehicle_id, day_of_week, start_time, end_time,
             timezone, is_active, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'America/Sao_Paulo', true, NOW(), NOW())`,
          [providerId, authUserId, vehicleId, day, startTime, endTime]
        );
      }
      availCount++;
    }

    summaryResults.push({
      email: spec.email,
      auth: 'OK',
      publicUser: 'OK',
      provider: 'OK',
      vehicle: 'OK',
      offering: 'OK',
      availabilities: availCount,
    });
  }

  console.log('=== SEEDING SUMMARY ===');
  console.table(summaryResults);

  await pool.end();
  return summaryResults;
}

runSeeder()
  .then(() => {
    console.log('SEED COMPLETE');
    process.exit(0);
  })
  .catch((err) => {
    console.error('SEED FAILED:', err);
    process.exit(1);
  });

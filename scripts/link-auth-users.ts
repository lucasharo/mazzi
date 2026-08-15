import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!databaseUrl || !supabaseUrl || !supabaseAnonKey) {
  console.error('Missing DATABASE_URL, SUPABASE_URL, or SUPABASE_ANON_KEY!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEMO_USERS_MAPPING = [
  {
    oldId: '11111111-1111-1111-1111-111111111101',
    email: 'aluno.demo@mazzi.com.br',
    name: 'Ana Clara Silva (Demo)',
    phone: '11988880001',
    role: 'STUDENT',
  },
  {
    oldId: '11111111-1111-1111-1111-111111111102',
    email: 'carlos.instrutor@mazzi.com.br',
    name: 'Carlos de Souza (Demo)',
    phone: '11988880002',
    role: 'INSTRUCTOR',
  },
  {
    oldId: '11111111-1111-1111-1111-111111111103',
    email: 'admin.paulista@mazzi.com.br',
    name: 'Diretor Autoescola Paulista (Demo)',
    phone: '11988880003',
    role: 'SCHOOL_ADMIN',
  },
  {
    oldId: '11111111-1111-1111-1111-111111111104',
    email: 'marcos.instrutor@mazzi.com.br',
    name: 'Marcos Vinícius (Demo)',
    phone: '11988880004',
    role: 'INSTRUCTOR', // school staff role
  },
  {
    oldId: '11111111-1111-1111-1111-111111111105',
    email: 'admin.master@mazzi.com.br',
    name: 'Administrador MAZZI (Demo)',
    phone: '11988880099',
    role: 'PLATFORM_ADMIN',
  },
];

async function linkUsers() {
  console.log('====================================================');
  console.log('MAZZI — SYNCHRONIZING AUTHENTICABLE DEMO ACCOUNTS');
  console.log('====================================================\n');

  const pgClient = await pool.connect();

  try {
    for (const user of DEMO_USERS_MAPPING) {
      console.log(`Processing ${user.role} (${user.email})...`);

      // 1. Sign Up the user publicly via Supabase Auth
      let authId: string | null = null;
      
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: user.email,
        password: 'MazziPassword123!',
        options: {
          data: {
            name: user.name,
            phone: user.phone,
            role: user.role,
          },
        },
      });

      if (signUpErr) {
        if (signUpErr.message.includes('already registered') || signUpErr.message.includes('User already registered')) {
          console.log(`User ${user.email} is already registered. Signing in to get ID...`);
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: 'MazziPassword123!',
          });

          if (signInErr) {
            console.error(`Sign in failed for ${user.email}:`, signInErr.message);
            continue;
          }
          authId = signInData.user?.id || null;
        } else {
          console.error(`Sign up failed for ${user.email}:`, signUpErr.message);
          continue;
        }
      } else {
        authId = signUpData.user?.id || null;
      }

      if (!authId) {
        console.error(`Could not retrieve auth ID for ${user.email}`);
        continue;
      }

      console.log(`Retrieved Auth ID: ${authId} for ${user.email}`);

      // 2. Perform atomic transaction in Postgres to migrate the old ID to the new Auth ID
      console.log(`Updating PostgreSQL references from ${user.oldId} to ${authId}...`);
      
      await pgClient.query('BEGIN');

      // Check if user already exists with the new auth ID in public.users
      const checkNew = await pgClient.query('SELECT 1 FROM users WHERE id = $1', [authId]);
      if (checkNew.rows.length === 0) {
        // Insert new user row copying fields from old user
        await pgClient.query(`
          INSERT INTO users (id, email, name, phone, role, status, avatar_url, bio, created_at, updated_at)
          SELECT $1, email, name, phone, role, status, avatar_url, bio, created_at, updated_at
          FROM users WHERE id = $2
        `, [authId, user.oldId]);
      }

      // Update referencing tables to the new ID
      await pgClient.query('UPDATE user_roles SET user_id = $1 WHERE user_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE user_custom_permissions SET user_id = $1 WHERE user_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE providers SET user_id = $1 WHERE user_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE driving_school_staff SET user_id = $1 WHERE user_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE bookings SET student_id = $1 WHERE student_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE bookings SET instructor_id = $1 WHERE instructor_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE quotes SET student_id = $1 WHERE student_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE quotes SET instructor_id = $1 WHERE instructor_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE service_offerings SET instructor_id = $1 WHERE instructor_id = $2', [authId, user.oldId]);
      await pgClient.query('UPDATE audit_logs SET actor_id = $1 WHERE actor_id = $2', [authId, user.oldId]);

      // Ensure new user has correct role in user_roles
      await pgClient.query(`
        INSERT INTO user_roles (user_id, role)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role) DO NOTHING
      `, [authId, user.role]);

      // Now we can safely delete the old user row
      await pgClient.query('DELETE FROM user_roles WHERE user_id = $1', [user.oldId]);
      await pgClient.query('DELETE FROM users WHERE id = $1', [user.oldId]);

      await pgClient.query('COMMIT');
      console.log(`Successfully mapped ${user.email} in DB.\n`);
    }

    console.log('All demo test identities mapped and synchronized successfully!');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('Linking transaction failed:', err);
  } finally {
    pgClient.release();
    await pool.end();
  }
}

linkUsers();

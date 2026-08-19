import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const availRes = await client.query(`
    SELECT * FROM public.availabilities LIMIT 5;
  `);
  console.log('Sample availabilities:', availRes.rows);

  const getPublicSlotsCode = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_available_slots_public';
  `);
  console.log('\nget_available_slots_public uses dow expression:');
  console.log(getPublicSlotsCode.rows[0]?.def.split('\n').filter((l: string) => l.includes('day_of_week')).join('\n'));

  await client.end();
}

main();

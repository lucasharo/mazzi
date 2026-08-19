import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const slotPublicDef = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_available_slots_public';
  `);
  console.log('=== get_available_slots_public DEFINITION ===');
  console.log(slotPublicDef.rows[0]?.def || 'NOT FOUND');

  const isAvailDef = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_offering_slot_available';
  `);
  console.log('\n=== is_offering_slot_available DEFINITION ===');
  console.log(isAvailDef.rows[0]?.def || 'NOT FOUND');

  await client.end();
}

main();

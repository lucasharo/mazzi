import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const offId = 'f8e465a4-4433-44fb-84f8-97728adcd77b';
  const offRes = await client.query(`SELECT * FROM public.service_offerings WHERE id = $1;`, [offId]);
  console.log('Offering details:', offRes.rows[0]);

  const testSlotStart = new Date(Date.now() + 86400000 * 60).toISOString();
  const testSlotEnd = new Date(new Date(testSlotStart).getTime() + (offRes.rows[0].duration_minutes || 50) * 60000).toISOString();

  const instId = offRes.rows[0].instructor_id;
  const vehId = offRes.rows[0].vehicle_id;

  const overlapRes = await client.query(`
    SELECT id, status, scheduled_start_at, scheduled_end_at, instructor_id, vehicle_id
    FROM public.bookings
    WHERE (instructor_id = $1 OR vehicle_id = $2)
      AND scheduled_start_at < $3
      AND scheduled_end_at > $4;
  `, [instId, vehId, testSlotEnd, testSlotStart]);

  console.log('Overlapping bookings on test slot:', overlapRes.rows);

  const availRes = await client.query(`SELECT public.is_offering_slot_available($1, $2) as avail;`, [offId, testSlotStart]);
  console.log('is_offering_slot_available result:', availRes.rows[0]);

  await client.end();
}

main();

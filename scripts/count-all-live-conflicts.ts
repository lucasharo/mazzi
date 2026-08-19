import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to PostgreSQL live database.');

  const res = await client.query(`
    SELECT
      b1.id as id1, b1.student_id, b1.status as status1, b1.created_at as created1, b1.scheduled_start_at as start1, b1.scheduled_end_at as end1,
      b2.id as id2, b2.status as status2, b2.created_at as created2, b2.scheduled_start_at as start2, b2.scheduled_end_at as end2
    FROM bookings b1
    JOIN bookings b2 ON b1.student_id = b2.student_id AND b1.id < b2.id
    WHERE b1.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
      AND b2.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
      AND b1.slot_range && b2.slot_range;
  `);

  console.log(`Total active student conflict pairs found on Supabase LIVE: ${res.rows.length}`);
  res.rows.forEach((row, idx) => {
    console.log(`\nConflict Pair #${idx + 1} (Student ${row.student_id}):`);
    console.log(' Booking 1:', { id: row.id1, status: row.status1, created: row.created1, start: row.start1, end: row.end1 });
    console.log(' Booking 2:', { id: row.id2, status: row.status2, created: row.created2, start: row.start2, end: row.end2 });
  });

  await client.end();
}

main().catch(console.error);

import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();

// 1. payments schema
const payments = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payments'
  ORDER BY ordinal_position
`);
console.log('\n=== payments columns ===');
payments.rows.forEach(r => console.log(`  ${r.column_name} | ${r.data_type} | nullable:${r.is_nullable} | default:${r.column_default}`));

// 2. unique constraints on payments
const uniq = await client.query(`
  SELECT tc.constraint_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'payments' AND tc.constraint_type = 'UNIQUE'
`);
console.log('\n=== payments UNIQUE constraints ===');
uniq.rows.forEach(r => console.log(`  ${r.constraint_name}: ${r.column_name}`));

// 3. payment_method enum values
const enumVals = await client.query(`
  SELECT e.enumlabel
  FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'payment_method'
  ORDER BY e.enumsortorder
`);
console.log('\n=== payment_method enum values ===');
enumVals.rows.forEach(r => console.log(`  ${r.enumlabel}`));

// 4. payment_status enum values
const statusVals = await client.query(`
  SELECT e.enumlabel
  FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
  WHERE t.typname = 'payment_status'
  ORDER BY e.enumsortorder
`);
console.log('\n=== payment_status enum values ===');
statusVals.rows.forEach(r => console.log(`  ${r.enumlabel}`));

// 5. student overlap constraint check
const excl = await client.query(`
  SELECT conname, contype FROM pg_constraint
  WHERE conname LIKE '%student%overlap%' OR conname LIKE '%student%booking%'
`);
console.log('\n=== student overlap constraints ===');
if (excl.rows.length === 0) console.log('  NONE FOUND');
else excl.rows.forEach(r => console.log(`  ${r.conname} (type:${r.contype})`));

// 6. Active student conflict pairs
const conflicts = await client.query(`
  SELECT b1.id as b1_id, b2.id as b2_id, b1.student_id,
         b1.scheduled_start_at, b1.scheduled_end_at
  FROM public.bookings b1
  JOIN public.bookings b2
    ON b1.student_id = b2.student_id
    AND b1.id < b2.id
    AND b1.scheduled_start_at < b2.scheduled_end_at
    AND b1.scheduled_end_at > b2.scheduled_start_at
    AND b1.status NOT IN ('CANCELLED', 'EXPIRED', 'REFUNDED')
    AND b2.status NOT IN ('CANCELLED', 'EXPIRED', 'REFUNDED')
`);
console.log('\n=== active student booking conflicts ===');
if (conflicts.rows.length === 0) console.log('  NONE');
else conflicts.rows.forEach(r => console.log(`  ${r.b1_id} vs ${r.b2_id} (student: ${r.student_id})`));

await client.end();

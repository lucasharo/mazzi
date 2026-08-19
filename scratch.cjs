const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function run() {
  await client.connect();
  const res1 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' AND is_nullable = 'NO'");
  const res2 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'service_offerings' AND is_nullable = 'NO'");
  console.log("vehicles:", res1.rows.map(r => r.column_name));
  console.log("offerings:", res2.rows.map(r => r.column_name));
  await client.end();
}
run().catch(console.error);

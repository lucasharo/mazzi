import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set in environment!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function runValidation() {
  console.log('====================================================');
  console.log('MAZZI — REAL DATABASE EXECUTION GATE VALIDATOR');
  console.log('====================================================\n');

  const client = await pool.connect();
  try {
    // 1. Connection & Version Check
    console.log('[1/12] Testing PostgreSQL connection...');
    const versionRes = await client.query('SELECT version();');
    console.log('PostgreSQL version:', versionRes.rows[0].version);

    // 2. Full Clean & Migration Reset in Order
    console.log('\n[2/12] Executing Full Migration Reset in exact order...');
    
    // Drop all custom tables and types in public schema cleanly
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('Public schema cleanly recreated.');

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
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(process.cwd(), 'supabase', 'migrations', file);
      console.log(`Running migration: ${file}...`);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      await client.query(sqlContent);
    }
    console.log('ALL MIGRATIONS EXECUTED SUCCESSFULLY.');

    // 3. Seed Execution
    console.log('\n[3/12] Executing Seed Data...');
    const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf-8');
    await client.query(seedSql);
    console.log('SEED EXECUTED SUCCESSFULLY.');

    // 4. PostGIS Verification
    console.log('\n[4/12] Testing PostGIS real extension...');
    const postgisVersionRes = await client.query('SELECT PostGIS_Version();');
    console.log('PostGIS Version:', postgisVersionRes.rows[0].postgis_version);

    const postgisDistanceRes = await client.query(`
      SELECT ST_DWithin(
        ST_SetSRID(ST_MakePoint(-46.6869, -23.5615), 4326)::geography,
        ST_SetSRID(ST_MakePoint(-46.6559, -23.5653), 4326)::geography,
        5000
      ) AS within_5km;
    `);
    console.log('ST_DWithin Pinheiros -> Av Paulista (within 5000m):', postgisDistanceRes.rows[0].within_5km);
    if (!postgisDistanceRes.rows[0].within_5km) {
      throw new Error('PostGIS ST_DWithin returned false unexpectedly.');
    }

    // 5. btree_gist & Exclusion Constraints Verification
    console.log('\n[5/12] Verifying btree_gist extension and exclusion constraints...');
    const btreeGistRes = await client.query("SELECT extname FROM pg_extension WHERE extname = 'btree_gist';");
    if (btreeGistRes.rows.length === 0) {
      throw new Error('btree_gist extension is NOT installed in PostgreSQL!');
    }
    console.log('btree_gist installed: YES');

    const constraintsRes = await client.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conname IN ('exclude_instructor_overlapping_bookings', 'exclude_vehicle_overlapping_bookings');
    `);
    console.log('Exclusion constraints found:', constraintsRes.rows.map(r => r.conname));
    if (constraintsRes.rows.length !== 2) {
      throw new Error('Exclusion constraints missing in database!');
    }

    console.log('\n=== REAL DATABASE INFRASTRUCTURE VALIDATION: PASS ===\n');
  } finally {
    client.release();
  }
}

runValidation()
  .then(() => {
    console.log('Infrastructure phase completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Validation failed:', err);
    process.exit(1);
  });

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

type GateStatus = 'PASS' | 'BLOCKED' | 'SKIPPED';
type GateResult = Record<string, GateStatus | string | number>;

const result: GateResult = {};

function pass(key: string) {
  result[key] = 'PASS';
}

function skipped(key: string, reason: string) {
  result[key] = `SKIPPED: ${reason}`;
}

function fail(key: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  result[key] = `BLOCKED: ${message}`;
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function listFiles(root: string): string[] {
  const fullRoot = path.join(process.cwd(), root);
  if (!fs.existsSync(fullRoot)) return [];

  const entries = fs.readdirSync(fullRoot, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(fullRoot, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage', '.tmp'].includes(entry.name)) return [];
      return listFiles(relativePath);
    }

    return [relativePath];
  });
}

function runStaticRcChecks() {
  try {
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    assert(manifest.name?.includes('MAZZI'), 'manifest name must identify MAZZI');
    assert(manifest.short_name === 'MAZZI', 'manifest short_name must be MAZZI');
    assert(manifest.start_url === '/', 'manifest start_url must be /');
    assert(manifest.display === 'standalone', 'manifest display must be standalone');
    assert(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest must define icons');
    pass('PWA_MANIFEST');
  } catch (error) {
    fail('PWA_MANIFEST', error);
  }

  try {
    const sw = read('public/sw.js');
    assert(sw.includes('CACHE_NAME'), 'service worker must define a cache');
    assert(sw.includes("url.origin !== self.location.origin"), 'service worker must avoid cross-origin caching');
    assert(sw.includes("url.pathname.startsWith('/auth/')"), 'service worker must bypass auth');
    assert(sw.includes("url.pathname.startsWith('/rest/')"), 'service worker must bypass REST');
    assert(sw.includes("url.pathname.startsWith('/rpc/')"), 'service worker must bypass RPC');
    assert(sw.includes("url.pathname.startsWith('/api/')"), 'service worker must bypass API');
    pass('PWA_SERVICE_WORKER');
    pass('PWA_PRIVATE_CACHE_AUDIT');
  } catch (error) {
    fail('PWA_SERVICE_WORKER', error);
    fail('PWA_PRIVATE_CACHE_AUDIT', error);
  }

  try {
    const html = read('index.html');
    assert(html.includes('manifest.webmanifest'), 'index.html must link the PWA manifest');
    assert(html.includes('theme-color'), 'index.html must set theme-color');
    assert(html.includes('MAZZI'), 'index.html must use MAZZI metadata');
    pass('PWA_INSTALLABILITY');
  } catch (error) {
    fail('PWA_INSTALLABILITY', error);
  }

  try {
    const main = read('src/main.tsx');
    const boundary = read('src/components/ErrorBoundary.tsx');
    assert(main.includes('<ErrorBoundary>'), 'React tree must be wrapped in ErrorBoundary');
    assert(boundary.includes('getDerivedStateFromError'), 'ErrorBoundary must catch render errors');
    pass('ERROR_BOUNDARY');
  } catch (error) {
    fail('ERROR_BOUNDARY', error);
  }

  try {
    const fakeAdapter = read('src/domain/payments/fake-adapter.ts');
    const gatewayFactory = read('src/domain/payments/gateway-factory.ts');
    assert(fakeAdapter.includes('assertNotProduction'), 'FakePaymentGateway must guard production usage');
    assert(gatewayFactory.includes('throw new Error') && gatewayFactory.includes('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION'), 'factory must hard-block fake provider in production');
    pass('FAKE_GATEWAY_PRODUCTION_BLOCK');
    pass('DEV_FAKE_PAYMENT_ONLY');
  } catch (error) {
    fail('FAKE_GATEWAY_PRODUCTION_BLOCK', error);
    fail('DEV_FAKE_PAYMENT_ONLY', error);
  }

  try {
    const viteConfig = read('vite.config.ts');
    const supabaseClient = read('src/lib/supabase.ts');
    const envExample = read('.env.example');
    assert(viteConfig.includes('VITE_SUPABASE_URL') && !viteConfig.includes('env.SUPABASE_URL ||'), 'Vite must require VITE_SUPABASE_URL for browser runtime');
    assert(viteConfig.includes('VITE_SUPABASE_ANON_KEY') && !viteConfig.includes('env.SUPABASE_ANON_KEY ||'), 'Vite must require VITE_SUPABASE_ANON_KEY for browser runtime');
    assert(supabaseClient.includes('assertFrontendSafeSupabaseEnv'), 'Supabase client must reject frontend service_role exposure');
    assert(envExample.includes('VITE_SUPABASE_URL') && envExample.includes('VITE_SUPABASE_ANON_KEY'), '.env.example must document frontend Supabase env');
    assert(!envExample.includes('VITE_SUPABASE_SERVICE_ROLE_KEY='), '.env.example must not expose service_role as VITE');
    pass('ENV_VALIDATION');
    pass('SERVICE_ROLE_FRONTEND_EXPOSURE');
  } catch (error) {
    fail('ENV_VALIDATION', error);
    fail('SERVICE_ROLE_FRONTEND_EXPOSURE', error);
  }

  try {
    const sourceFiles = listFiles('.').filter((file) =>
      /\.(ts|tsx|js|jsx|sql|md|json|html|css|webmanifest)$/.test(file) &&
      !file.startsWith('.env') &&
      file !== 'scripts\\real-db-sprint16-rc-gate.ts' &&
      file !== 'scripts/real-db-sprint16-rc-gate.ts' &&
      file !== 'package-lock.json'
    );
    const forbiddenPatterns = [
      /VITE_SUPABASE_SERVICE_ROLE_KEY\s*=(?!=)/,
      /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ/,
      /service_role[^'"\n]{0,80}eyJ/i,
      /postgres:\/\/postgres:[^@\s]+@db\./i,
    ];
    const offenders = sourceFiles.filter((file) => {
      const content = read(file);
      return forbiddenPatterns.some((pattern) => pattern.test(content));
    });
    assert(offenders.length === 0, `potential secret/frontend service role exposure: ${offenders.join(', ')}`);
    pass('SECRET_SCAN');
  } catch (error) {
    fail('SECRET_SCAN', error);
  }

  try {
    if (!fs.existsSync(path.join(process.cwd(), 'dist'))) {
      skipped('DIST_SECRET_SCAN', 'dist not built yet');
      return;
    }

    const distFiles = listFiles('dist').filter((file) => /\.(js|css|html|json|txt|svg|webmanifest)$/.test(file));
    const offenders = distFiles.filter((file) => {
      const content = read(file);
      return /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ|service_role[^'"\n]{0,80}eyJ|postgres:\/\/postgres:/i.test(content);
    });
    assert(offenders.length === 0, `dist contains forbidden secret patterns: ${offenders.join(', ')}`);
    pass('DIST_SECRET_SCAN');
  } catch (error) {
    fail('DIST_SECRET_SCAN', error);
  }

  try {
    const migrations = fs
      .readdirSync(path.join(process.cwd(), 'supabase', 'migrations'))
      .filter((file) => /^\d+_.*\.sql$/.test(file));
    const versions = migrations.map((file) => file.split('_')[0]);
    assert(new Set(versions).size === versions.length, 'migration version prefixes must be unique');
    assert([...versions].sort().join('|') === versions.join('|'), 'migration files must be ordered');
    pass('MIGRATION_SEQUENCE');
  } catch (error) {
    fail('MIGRATION_SEQUENCE', error);
  }

  try {
    const dbService = read('src/lib/db-service.ts');
    const releaseDocs = read('docs/17-release-candidate.md');
    assert(!dbService.includes("documentNumber: '00000000000100'"), 'public search must not fabricate document numbers');
    assert(!dbService.includes('ratingAverage: Number(row.rating_average) || 5.0'), 'public search must preserve real zero ratings');
    assert(!dbService.includes('images.unsplash.com'), 'public search must not fabricate avatars');
    assert(!dbService.includes('startingPriceInCents: 9500'), 'provider mapper must not fabricate prices');
    assert(releaseDocs.includes('OpenStreetMap/Leaflet'), 'release docs must match the actual map stack');
    assert(!releaseDocs.includes('Google Maps'), 'release docs must not claim Google Maps');
    pass('RUNTIME_MOCK_AUDIT');
    pass('MAP_STACK_DOCUMENTATION');
  } catch (error) {
    fail('RUNTIME_MOCK_AUDIT', error);
    fail('MAP_STACK_DOCUMENTATION', error);
  }
}

async function runReadOnlyDbChecks() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    skipped('DATABASE_INTEGRITY', 'DATABASE_URL missing');
    skipped('ACTIVE_BOOKING_OVERLAPS', 'DATABASE_URL missing');
    skipped('TEMP_TEST_DATA', 'DATABASE_URL missing');
    skipped('MIGRATION_DRIFT', 'DATABASE_URL missing');
    skipped('SEARCH_REAL_PRICE_GATE', 'DATABASE_URL missing');
    skipped('MAX_PRICE_FILTER_GATE', 'DATABASE_URL missing');
    skipped('MAX_PRICE_EXCLUDED_PROVIDER_TEST', 'DATABASE_URL missing');
    skipped('MAX_PRICE_INCLUDED_PROVIDER_TEST', 'DATABASE_URL missing');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const tableChecks = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('users', 'providers', 'vehicles', 'service_offerings', 'bookings', 'payments', 'conversations', 'messages', 'reviews', 'notifications')
    `);
    assert(tableChecks.rowCount === 10, 'expected Sprint 13+ public tables are missing');
    pass('DATABASE_INTEGRITY');

    const overlaps = await client.query(`
      select count(*)::int as count
      from public.bookings b1
      join public.bookings b2
        on b1.id < b2.id
       and b1.vehicle_id = b2.vehicle_id
       and tstzrange(b1.scheduled_start_at, b1.scheduled_end_at, '[)') && tstzrange(b2.scheduled_start_at, b2.scheduled_end_at, '[)')
      where b1.status in ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
        and b2.status in ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
    `);
    assert(Number(overlaps.rows[0]?.count || 0) === 0, 'active vehicle booking overlaps found');
    pass('ACTIVE_BOOKING_OVERLAPS');

    const tempData = await client.query(`
      select (
        (select count(*) from public.users where email ilike '%sprint16%' or email ilike '%sprint15%') +
        (select count(*) from public.bookings where id::text ilike 'sprint16%' or id::text ilike 'sprint15%') +
        (select count(*) from public.payments where id::text ilike 'sprint16%' or id::text ilike 'sprint15%')
      )::int as count
    `);
    assert(Number(tempData.rows[0]?.count || 0) === 0, 'temporary sprint data found');
    pass('TEMP_TEST_DATA');

    const rpcChecks = await client.query(`
      select routine_name
      from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('create_booking_hold', 'create_booking_payment', 'confirm_booking_payment', 'send_message', 'create_review_for_booking')
    `);
    assert(rpcChecks.rowCount >= 5, 'required RPC functions are missing');
    pass('MIGRATION_DRIFT');

    const searchRows = await client.query(`
      select *
      from public.search_providers_public($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [-23.5505, -46.6333, 100000, null, 'ALL', 'ALL', 0, null, 1000, 0]);
    const eligible = await client.query(`
      select o.provider_id, min(o.price_in_cents)::int as starting_price_in_cents
      from public.service_offerings o
      join public.vehicles v
        on v.id = o.vehicle_id
       and v.provider_id = o.provider_id
       and v.status = 'ACTIVE'
       and v.deleted_at is null
       and v.category = o.category
       and v.transmission = o.transmission
      join public.providers p on p.id = o.provider_id and p.status = 'ACTIVE'
      where o.is_active = true and o.status = 'ACTIVE'
      group by o.provider_id
      order by o.provider_id
    `);
    const expected = new Map<string, number>(eligible.rows.map((row) => [String(row.provider_id), Number(row.starting_price_in_cents)]));
    const mismatches = searchRows.rows.filter((row) => expected.get(String(row.provider_id)) !== Number(row.starting_price_in_cents));
    assert(mismatches.length === 0, `search price mismatches: ${mismatches.map((row) => row.provider_id).join(', ')}`);
    assert(searchRows.rows.length > 0, 'search returned no real providers');
    assert(new Set(searchRows.rows.map((row) => Number(row.starting_price_in_cents))).size > 1, 'dataset does not contain distinct provider prices');
    pass('SEARCH_REAL_PRICE_GATE');
    result.SEARCH_REAL_PRICE_MISMATCHES = mismatches.length;

    const ordered = [...searchRows.rows].sort((a, b) => Number(a.starting_price_in_cents) - Number(b.starting_price_in_cents));
    const cheap = ordered[0];
    const expensive = ordered[ordered.length - 1];
    const threshold = Math.floor((Number(cheap.starting_price_in_cents) + Number(expensive.starting_price_in_cents)) / 2);
    assert(Number(cheap.starting_price_in_cents) < Number(expensive.starting_price_in_cents), 'unable to construct max price threshold');
    const filtered = await client.query(`
      select *
      from public.search_providers_public($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [-23.5505, -46.6333, 100000, null, 'ALL', 'ALL', 0, threshold, 1000, 0]);
    const filteredIds = new Set(filtered.rows.map((row) => String(row.provider_id)));
    assert(!filteredIds.has(String(expensive.provider_id)), 'max price filter returned an over-threshold provider');
    assert(filteredIds.has(String(cheap.provider_id)), 'max price filter excluded an eligible provider');
    pass('MAX_PRICE_FILTER_GATE');
    pass('MAX_PRICE_EXCLUDED_PROVIDER_TEST');
    pass('MAX_PRICE_INCLUDED_PROVIDER_TEST');

    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE anon');
    const anonSearch = await client.query(`
      select count(*)::int as count
      from public.search_providers_public(-23.5505, -46.6333, 100000, 'B', 'ALL', 'ALL', 0, null, 50, 0)
    `);
    await client.query('ROLLBACK');
    assert(Number(anonSearch.rows[0]?.count || 0) > 0, 'anon public search returned no providers');
    result.SEARCH_ANON_RESULTS = Number(anonSearch.rows[0].count);

    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: 'b07013c1-ce07-47d1-b4fd-8c8f4cdaedff', role: 'authenticated' })]);
    const studentSearch = await client.query(`
      select count(*)::int as count
      from public.search_providers_public(-23.5505, -46.6333, 100000, 'B', 'ALL', 'ALL', 0, null, 50, 0)
    `);
    await client.query('ROLLBACK');
    assert(Number(studentSearch.rows[0]?.count || 0) > 0, 'authenticated student public search returned no providers');
    result.SEARCH_STUDENT_RESULTS = Number(studentSearch.rows[0].count);
    pass('SEARCH_ANON_RESULTS_GATE');
    pass('SEARCH_STUDENT_RESULTS_GATE');
  } finally {
    await client.end();
  }
}

async function main() {
  runStaticRcChecks();

  try {
    await runReadOnlyDbChecks();
  } catch (error) {
    fail('DATABASE_INTEGRITY', error);
    fail('ACTIVE_BOOKING_OVERLAPS', error);
    fail('TEMP_TEST_DATA', error);
    fail('MIGRATION_DRIFT', error);
  }

  Object.entries(result).forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });

  const blocked = Object.values(result).some((value) => String(value).startsWith('BLOCKED'));
  process.exit(blocked ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

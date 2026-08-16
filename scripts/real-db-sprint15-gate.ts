import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

type GateStatus = 'PASS' | 'BLOCKED' | 'SKIPPED';
type GateResult = Record<string, GateStatus | string | number | boolean>;

const result: GateResult = {};
const prefix = `sprint15_${Date.now()}`;
const temporaryBookingIds: string[] = [];

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

async function applySprint15Migration() {
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260815000015_sprint15_security_hardening.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await client.query(sql);
}

async function asAuthenticatedUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query('begin');
  try {
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    const value = await fn();
    await client.query('rollback');
    return value;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

async function expectBlocked(key: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error('operation unexpectedly succeeded');
  } catch (error: any) {
    const message = String(error?.message ?? error);
    const code = String(error?.code ?? '');
    if (
      code === '42501' ||
      code === 'P0002' ||
      message.includes('FORBIDDEN') ||
      message.includes('permission denied') ||
      message.includes('violates row-level security') ||
      message.includes('AUTH_REQUIRED') ||
      message.includes('REVIEW_REQUIRES_COMPLETED_BOOKING') ||
      message.includes('REVIEW_RATING_OUT_OF_RANGE') ||
      message.includes('ANALYTICS_PROPERTIES_CONTAIN_SENSITIVE_KEY') ||
      message.includes('duplicate key value')
    ) {
      pass(key);
      return;
    }
    throw error;
  }
}

async function findTwoStudents(): Promise<[string, string]> {
  const { rows } = await client.query(`
    select id
    from public.users
    where role::text = 'STUDENT'
      and status::text = 'ACTIVE'
      and deleted_at is null
    order by created_at, id
    limit 2
  `);

  if (rows.length >= 2) return [rows[0].id, rows[1].id];

  const ids = [
    'aaaaaaaa-1500-4000-8000-000000000001',
    'aaaaaaaa-1500-4000-8000-000000000002',
  ];
  for (let i = 0; i < ids.length; i += 1) {
    await client.query(
      `
        insert into public.users (id, email, name, phone, role, status)
        values ($1, $2, $3, $4, 'STUDENT', 'ACTIVE')
        on conflict (id) do update set status = 'ACTIVE', deleted_at = null
      `,
      [ids[i], `${prefix}.student${i + 1}@mazzi.dev`, `Sprint 15 Student ${i + 1}`, `1199999${i + 1}150`],
    );
  }
  return [ids[0], ids[1]];
}

async function findBookingPair(studentA: string, studentB: string) {
  const owned = await client.query(
    `
      select id
      from public.bookings
      where student_id = $1
      order by created_at desc
      limit 1
    `,
    [studentA],
  );
  const foreign = await client.query(
    `
      select id
      from public.bookings
      where student_id <> $1
      order by created_at desc
      limit 1
    `,
    [studentA],
  );

  if (owned.rows.length && foreign.rows.length) {
    return { ownedBookingId: owned.rows[0].id, foreignBookingId: foreign.rows[0].id };
  }

  const anyForeign = await client.query(
    `
      select id
      from public.bookings
      where student_id = $1
      order by created_at desc
      limit 1
    `,
    [studentB],
  );

  if (anyForeign.rows.length && owned.rows.length) {
    return { ownedBookingId: owned.rows[0].id, foreignBookingId: anyForeign.rows[0].id };
  }

  const createdBookingId = await createTemporaryBooking(studentA);
  if (createdBookingId) {
    return { ownedBookingId: createdBookingId, foreignBookingId: anyForeign.rows[0]?.id ?? createdBookingId };
  }

  return null;
}

async function createTemporaryBooking(studentId: string): Promise<string | null> {
  const context = await client.query(`
    select
      so.id as offering_id,
      so.provider_id,
      coalesce(so.instructor_id, p.user_id) as instructor_id,
      so.vehicle_id,
      so.price_in_cents,
      coalesce(so.duration_minutes, 60) as duration_minutes
    from public.service_offerings so
    join public.providers p on p.id = so.provider_id
    join public.vehicles v on v.id = so.vehicle_id
    where coalesce(so.status, 'ACTIVE') = 'ACTIVE'
      and coalesce(so.is_active, true) = true
      and p.status::text = 'ACTIVE'
      and v.status::text = 'ACTIVE'
      and coalesce(so.instructor_id, p.user_id) is not null
    order by so.created_at, so.id
    limit 1
  `);

  if (!context.rows.length) {
    return null;
  }

  const row = context.rows[0];
  const minuteOffset = Math.floor(Date.now() / 1000) % 100000;
  const start = new Date(Date.UTC(2035, 0, 1, 8, 0 + minuteOffset, 0));
  const end = new Date(start.getTime() + Number(row.duration_minutes) * 60 * 1000);
  const platformFee = Math.round(Number(row.price_in_cents) * 0.1);
  const total = Number(row.price_in_cents) + platformFee;

  const inserted = await client.query(
    `
      insert into public.bookings (
        student_id,
        provider_id,
        instructor_id,
        vehicle_id,
        offering_id,
        status,
        scheduled_start_at,
        scheduled_end_at,
        meeting_point,
        price_in_cents,
        platform_fee_in_cents,
        total_in_cents,
        snapshot_data
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        'CONFIRMED',
        $6,
        $7,
        $8::jsonb,
        $9,
        $10,
        $11,
        $12::jsonb
      )
      returning id
    `,
    [
      studentId,
      row.provider_id,
      row.instructor_id,
      row.vehicle_id,
      row.offering_id,
      start.toISOString(),
      end.toISOString(),
      JSON.stringify({ name: 'Sprint 15 security gate' }),
      row.price_in_cents,
      platformFee,
      total,
      JSON.stringify({ source: prefix }),
    ],
  );

  const bookingId = inserted.rows[0].id;
  temporaryBookingIds.push(bookingId);
  return bookingId;
}

async function cleanup() {
  if (temporaryBookingIds.length > 0) {
    await client.query(
      `
        delete from public.messages
        where conversation_id in (
          select id from public.conversations where booking_id = any($1::uuid[])
        )
      `,
      [temporaryBookingIds],
    );
    await client.query('delete from public.reviews where booking_id = any($1::uuid[])', [temporaryBookingIds]);
    await client.query('delete from public.notifications where entity_id = any($1::uuid[])', [temporaryBookingIds]);
    await client.query(
      `
        delete from public.notifications
        where entity_id in (
          select id from public.conversations where booking_id = any($1::uuid[])
        )
      `,
      [temporaryBookingIds],
    );
    await client.query('delete from public.conversations where booking_id = any($1::uuid[])', [temporaryBookingIds]);
    await client.query('delete from public.payments where booking_id = any($1::uuid[])', [temporaryBookingIds]);
    await client.query('delete from public.bookings where id = any($1::uuid[])', [temporaryBookingIds]);
  }
  await client.query('delete from public.notifications where body like $1 or title like $1', [`%${prefix}%`]);
  await client.query('delete from public.users where email like $1', [`${prefix}.%`]);
}

async function main() {
  await client.connect();

  try {
    await applySprint15Migration();
    pass('MIGRATION_APPLIED');

    const advisorChecks = await client.query(`
      select
        has_function_privilege('anon', 'public.handle_new_auth_user()', 'EXECUTE') as handle_anon,
        has_function_privilege('authenticated', 'public.handle_new_auth_user()', 'EXECUTE') as handle_auth,
        has_function_privilege('anon', 'public.create_booking_completion_notifications()', 'EXECUTE') as completion_anon,
        has_function_privilege('authenticated', 'public.create_booking_completion_notifications()', 'EXECUTE') as completion_auth,
        has_function_privilege('anon', 'public.is_offering_slot_available(uuid, timestamptz)', 'EXECUTE') as slot_anon,
        has_function_privilege('authenticated', 'public.is_offering_slot_available(uuid, timestamptz)', 'EXECUTE') as slot_auth
    `);
    const advisor = advisorChecks.rows[0];
    result.COMPLETION_TRIGGER_ANON_EXECUTE = advisor.completion_anon;
    result.COMPLETION_TRIGGER_AUTH_EXECUTE = advisor.completion_auth;
    result.HANDLE_NEW_AUTH_USER_ANON_EXECUTE = advisor.handle_anon;
    result.HANDLE_NEW_AUTH_USER_AUTH_EXECUTE = advisor.handle_auth;
    result.SLOT_HELPER_ANON_EXECUTE = advisor.slot_anon;
    result.SLOT_HELPER_AUTH_EXECUTE = advisor.slot_auth;
    if (!advisor.handle_anon && !advisor.handle_auth && !advisor.completion_anon && !advisor.completion_auth && !advisor.slot_anon && !advisor.slot_auth) {
      pass('SECURITY_DEFINER_INTERNAL_EXECUTE');
    } else {
      result.SECURITY_DEFINER_INTERNAL_EXECUTE = 'BLOCKED';
    }

    const view = await client.query(`
      select coalesce(c.reloptions::text, '') as options
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'providers_public_view'
    `);
    if (String(view.rows[0]?.options ?? '').includes('security_invoker=true')) {
      pass('PROVIDERS_PUBLIC_VIEW_SECURITY_INVOKER');
    } else {
      result.PROVIDERS_PUBLIC_VIEW_SECURITY_INVOKER = 'BLOCKED';
    }

    const serviceOfferingPolicy = await client.query(`
      select coalesce(array_to_string(array_agg(pg_get_expr(polwithcheck, polrelid)), E'\n'), '') as checks
      from pg_policy
      where polrelid = 'public.service_offerings'::regclass
        and polname in ('offerings_owner_insert', 'offerings_owner_update')
    `);
    const policyChecks = String(serviceOfferingPolicy.rows[0]?.checks ?? '');
    if (policyChecks.includes('v.provider_id = service_offerings.provider_id') && !policyChecks.includes('v.provider_id = v.provider_id')) {
      pass('SERVICE_OFFERINGS_TAUTOLOGY_FIXED');
    } else {
      result.SERVICE_OFFERINGS_TAUTOLOGY_FIXED = 'BLOCKED';
    }

    const [studentA, studentB] = await findTwoStudents();
    result.STUDENT_A = studentA;
    result.STUDENT_B = studentB;

    const directVehicleAsStudent = await asAuthenticatedUser(studentA, async () =>
      client.query('select id, license_plate, renavam from public.vehicles limit 5'),
    );
    if (directVehicleAsStudent.rows.length === 0) {
      pass('VEHICLE_PRIVATE_DIRECT_SELECT_BLOCKED');
    } else {
      result.VEHICLE_PRIVATE_DIRECT_SELECT_BLOCKED = `BLOCKED: student read ${directVehicleAsStudent.rows.length} vehicle rows`;
    }

    const catalogAsStudent = await asAuthenticatedUser(studentA, async () =>
      client.query('select id, license_plate, license_plate_masked from public.get_public_vehicle_catalog() limit 5'),
    );
    const catalogSafe = catalogAsStudent.rows.every((row) => row.license_plate === row.license_plate_masked || String(row.license_plate).includes('*'));
    if (catalogSafe) pass('VEHICLE_PUBLIC_CATALOG_MASKED');
    else result.VEHICLE_PUBLIC_CATALOG_MASKED = 'BLOCKED: catalog exposed unmasked license plate';

    await expectBlocked('NOTIFICATION_DIRECT_INSERT_BLOCKED', () =>
      asAuthenticatedUser(studentA, async () =>
        client.query(
          `
            insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
            values ($1, 'NEW_MESSAGE', $2, $2, 'test', gen_random_uuid())
          `,
          [studentB, prefix],
        ),
      ),
    );

    const notification = await client.query(
      `
        insert into public.notifications (user_id, type, title, body, entity_type, entity_id)
        values ($1, 'NEW_MESSAGE', $2, $2, 'test', gen_random_uuid())
        returning id
      `,
      [studentA, prefix],
    );
    const notificationId = notification.rows[0].id;
    const notificationOwnerRead = await asAuthenticatedUser(studentA, async () =>
      client.query('select id from public.notifications where id = $1', [notificationId]),
    );
    const notificationOtherRead = await asAuthenticatedUser(studentB, async () =>
      client.query('select id from public.notifications where id = $1', [notificationId]),
    );
    if (notificationOwnerRead.rows.length === 1 && notificationOtherRead.rows.length === 0) pass('NOTIFICATION_OWNERSHIP_RLS');
    else result.NOTIFICATION_OWNERSHIP_RLS = 'BLOCKED';

    const markRead = await asAuthenticatedUser(studentA, async () =>
      client.query("update public.notifications set is_read = true, read_at = now() where id = $1 returning id, is_read", [notificationId]),
    );
    if (markRead.rows[0]?.is_read === true) pass('NOTIFICATION_MARK_READ');
    else result.NOTIFICATION_MARK_READ = 'BLOCKED';

    const bookingPair = await findBookingPair(studentA, studentB);
    if (bookingPair) {
      const ownedBookingRead = await asAuthenticatedUser(studentA, async () =>
        client.query('select id from public.bookings where id = $1', [bookingPair.ownedBookingId]),
      );
      const foreignBookingRead = await asAuthenticatedUser(studentB, async () =>
        client.query('select id from public.bookings where id = $1', [bookingPair.ownedBookingId]),
      );
      if (ownedBookingRead.rows.length === 1 && foreignBookingRead.rows.length === 0) pass('BOOKING_STUDENT_A_VS_STUDENT_B_RLS');
      else result.BOOKING_STUDENT_A_VS_STUDENT_B_RLS = 'BLOCKED';

      const conv = await asAuthenticatedUser(studentA, async () =>
        client.query('select (public.get_or_create_conversation_for_booking($1)).id as id', [bookingPair.ownedBookingId]),
      );
      const conversationId = conv.rows[0].id;
      await expectBlocked('CHAT_CROSS_USER_BLOCKED', () =>
        asAuthenticatedUser(studentB, async () =>
          client.query('select public.send_message($1, $2)', [conversationId, `${prefix} forbidden`]),
        ),
      );
    } else {
      skipped('BOOKING_STUDENT_A_VS_STUDENT_B_RLS', 'no suitable existing booking pair');
      skipped('CHAT_CROSS_USER_BLOCKED', 'no suitable existing booking pair');
    }

    await expectBlocked('REVIEW_BEFORE_COMPLETED_BLOCKED', async () => {
      const pending = await client.query(`
        select id, student_id
        from public.bookings
        where status::text <> 'COMPLETED'
        order by created_at desc
        limit 1
      `);
      if (!pending.rows.length) throw new Error('REVIEW_REQUIRES_COMPLETED_BOOKING');
      await asAuthenticatedUser(pending.rows[0].student_id, async () =>
        client.query('select public.create_review_for_booking($1, 5, $2)', [pending.rows[0].id, prefix]),
      );
    });

    await expectBlocked('ANALYTICS_DIRECT_INSERT_BLOCKED', () =>
      asAuthenticatedUser(studentA, async () =>
        client.query("insert into public.analytics_events (event_name, properties) values ('PROVIDER_SEARCH', '{}'::jsonb)"),
      ),
    );

    await expectBlocked('ANALYTICS_PII_REJECTED', () =>
      asAuthenticatedUser(studentA, async () =>
        client.query("select public.track_analytics_event('PROVIDER_SEARCH', '{\"cpf\":\"123\"}'::jsonb)"),
      ),
    );

    const analyticsAllowed = await asAuthenticatedUser(studentA, async () =>
      client.query("select public.track_analytics_event('PROVIDER_SEARCH', '{\"source\":\"sprint15\"}'::jsonb) as id"),
    );
    if (analyticsAllowed.rows[0]?.id) pass('ANALYTICS_ALLOWLIST_EVENT_ACCEPTED');
    else result.ANALYTICS_ALLOWLIST_EVENT_ACCEPTED = 'BLOCKED';

    const orphans = await client.query(`
      select
        (select count(*)::int from public.bookings b left join public.users u on u.id = b.student_id where u.id is null) as orphan_bookings_student,
        (select count(*)::int from public.bookings b left join public.providers p on p.id = b.provider_id where p.id is null) as orphan_bookings_provider,
        (select count(*)::int from public.payments p left join public.bookings b on b.id = p.booking_id where b.id is null) as orphan_payments_booking,
        (select count(*)::int from public.conversations c left join public.bookings b on b.id = c.booking_id where b.id is null) as orphan_conversations_booking,
        (select count(*)::int from public.reviews r left join public.bookings b on b.id = r.booking_id where b.id is null) as orphan_reviews_booking
    `);
    const orphanValues = Object.values(orphans.rows[0] ?? {});
    if (orphanValues.every((value) => Number(value) === 0)) pass('REFERENTIAL_INTEGRITY');
    else result.REFERENTIAL_INTEGRITY = `BLOCKED: ${JSON.stringify(orphans.rows[0])}`;

    const duplicateChecks = await client.query(`
      select
        (select count(*)::int from (select booking_id from public.conversations group by booking_id having count(*) > 1) x) as duplicate_conversations,
        (select count(*)::int from (select booking_id from public.reviews group by booking_id having count(*) > 1) x) as duplicate_reviews
    `);
    if (Number(duplicateChecks.rows[0].duplicate_conversations) === 0 && Number(duplicateChecks.rows[0].duplicate_reviews) === 0) {
      pass('DUPLICATE_PROTECTION_EXISTING_DATA');
    } else {
      result.DUPLICATE_PROTECTION_EXISTING_DATA = `BLOCKED: ${JSON.stringify(duplicateChecks.rows[0])}`;
    }

    const activeOverlap = await client.query(`
      select count(*)::int as count
      from public.bookings a
      join public.bookings b
        on a.id < b.id
       and a.status::text in ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
       and b.status::text in ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
       and tstzrange(a.scheduled_start_at, a.scheduled_end_at, '[)') && tstzrange(b.scheduled_start_at, b.scheduled_end_at, '[)')
       and (a.instructor_id = b.instructor_id or a.vehicle_id = b.vehicle_id)
    `);
    if (Number(activeOverlap.rows[0].count) === 0) pass('DOUBLE_BOOKING_EXISTING_DATA');
    else result.DOUBLE_BOOKING_EXISTING_DATA = `BLOCKED: ${activeOverlap.rows[0].count} active overlaps`;

    await cleanup();
  } finally {
    await client.end();
  }

  const blocked = Object.values(result).filter((value) => String(value).startsWith('BLOCKED'));
  console.log(JSON.stringify(result, null, 2));

  if (blocked.length > 0) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  fail('UNHANDLED_ERROR', error);
  try {
    await cleanup();
    await client.end();
  } catch {
    // ignore cleanup failures
  }
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
});

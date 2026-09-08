import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260823220956_require_both_checkins_and_extend_checkin_window.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const providerModal = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderBookingDetailsModal.tsx'), 'utf8');
const studentModal = fs.readFileSync(path.join(root, 'src/apps/student/components/BookingDetailsModal.tsx'), 'utf8');
const sharedBookingDetails = fs.readFileSync(path.join(root, 'src/components/booking/BookingDetailsShared.tsx'), 'utf8');
const schedule = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderScheduleTab.tsx'), 'utf8');
const checkinLocationMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260908200000_checkin_location_and_unify_checkin_flow.sql'), 'utf8');

describe('TASK-090 check-in contract', () => {
  it('uses the LIVE migration version locally and has no old duplicate', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260824010000_require_both_checkins_and_extend_checkin_window.sql'))).toBe(false);
    expect(migration).toContain('CHECKIN_WINDOW_NOT_OPEN');
    expect(migration).not.toContain("scheduled_end_at + INTERVAL '60 minutes'");
  });

  it('opens check-in 30 minutes before and has no end-time expiry', () => {
    expect(migration).toContain("scheduled_start_at - INTERVAL '30 minutes'");
    expect(migration).not.toContain('CHECKIN_WINDOW_EXPIRED');
    expect(migration).toContain("IN ('CONFIRMED', 'IN_PROGRESS')");
  });

  it('requires both check-ins before starting and keeps start idempotent', () => {
    expect(migration).toContain('INSTRUCTOR_CHECKIN_REQUIRED');
    expect(migration).toContain('STUDENT_CHECKIN_REQUIRED');
    expect(migration).toContain("status::TEXT = 'IN_PROGRESS'");
    expect(providerModal).toContain('booking.instructorCheckedIn && booking.studentCheckedIn');
    expect(sharedBookingDetails).toContain('Aguardando abertura do check-in · disponível a partir de');
  });

  it('explains that the address for scheduled and Aula Agora lessons is released after starting displacement', () => {
    expect(providerModal).toContain('const canShowMeetingPoint = !isWaitingPayment && (isOnTheWay || isProviderMeetingPoint || isCompleted);');
    expect(providerModal).toContain('const completedMapOnly = isCompleted && Boolean(mapPoint);');
    expect(providerModal).toContain('const meetingPointNotice = !canShowMeetingPoint && !isWaitingPayment');
    expect(providerModal).toContain('meetingPointNotice={meetingPointNotice}');
    expect(providerModal).toContain("meetingPoint={completedMapOnly ? '' : canShowMeetingPoint ? meetingPointText : ''}");
    expect(providerModal).toContain('showCopyAddress={!isWaitingPayment && isOnTheWay && !isProviderMeetingPoint && !isCompleted}');
    expect(providerModal).toContain('showMarker />');
    expect(providerModal).toContain('showNavigation={!isInProgress && hasExactMeetingPoint && !isProviderMeetingPoint}');
    expect(providerModal).toContain('{latitude != null && longitude != null && !isCompleted && (');
    expect(studentModal).toContain('const completedMapOnly = isCompleted && Boolean(mapPoint);');
    expect(studentModal).toContain("meetingPoint={completedMapOnly ? '' : visibleMeetingPoint}");
    expect(studentModal).toContain('showCopyAddress={isProviderAddress && !isPendingPayment && !shouldHideProviderLocation && !isCompleted}');
    expect(studentModal).toContain('{completedMapOnly && !isPendingPayment && mapPoint && (');
    expect(studentModal).toContain('showMarker />');
    expect(studentModal).toContain('{isProviderAddress && mapPoint && !isCompleted && (');
    expect(providerModal).toContain("const modalTitle = 'Detalhes da aula';");
    expect(providerModal).not.toContain("'Aula Agora Confirmada'");
    expect(providerModal).toContain('const isArrived = hasArrivedState || Boolean(booking.instructorCheckedIn);');
    expect(providerModal).not.toContain('provider_arrived_at');
  });

  it('presents date-only blocks as one semantic phrase', () => {
    expect(schedule).toContain('— {dayRange.label}');
    expect(schedule).not.toContain('<p className="text-xs font-semibold text-slate-600">{dayRange.label}</p>');
  });

  it('stores validated student and provider check-in coordinates and removes the separate arrival marker', () => {
    expect(checkinLocationMigration).toContain('checkin_student_latitude DOUBLE PRECISION');
    expect(checkinLocationMigration).toContain('checkin_instructor_longitude DOUBLE PRECISION');
    expect(checkinLocationMigration).toContain('CHECKIN_LOCATION_REQUIRED');
    expect(checkinLocationMigration).toContain('p_latitude DOUBLE PRECISION');
    expect(checkinLocationMigration).toContain('p_longitude DOUBLE PRECISION');
    expect(checkinLocationMigration).toContain("DROP FUNCTION IF EXISTS public.provider_mark_arrived(UUID)");
    expect(checkinLocationMigration).toContain("snapshot_data = snapshot_data - 'provider_arrived_at'");
  });
});

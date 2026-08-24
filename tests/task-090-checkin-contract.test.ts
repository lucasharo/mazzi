import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260823220956_require_both_checkins_and_extend_checkin_window.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const providerModal = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderBookingDetailsModal.tsx'), 'utf8');
const studentModal = fs.readFileSync(path.join(root, 'src/apps/student/components/BookingDetailsModal.tsx'), 'utf8');
const schedule = fs.readFileSync(path.join(root, 'src/apps/provider/components/ProviderScheduleTab.tsx'), 'utf8');

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
    expect(providerModal).toContain('Aguardando abertura do check-in');
    expect(studentModal).toContain('Check-in disponível a partir de');
  });

  it('presents date-only blocks as one semantic phrase', () => {
    expect(schedule).toContain('— {dayRange.label}');
    expect(schedule).not.toContain('<p className="text-xs font-semibold text-slate-600">{dayRange.label}</p>');
  });
});

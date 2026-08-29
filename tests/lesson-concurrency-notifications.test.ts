import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260828190000_lesson_concurrency_and_notifications.sql'),
  'utf8',
);

describe('aula em andamento e notificações operacionais', () => {
  it('serializa inícios por aluno e instrutor e impede conflito existente', () => {
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('lesson_student:'");
    expect(migration).toContain("pg_advisory_xact_lock(hashtextextended('lesson_instructor:'");
    expect(migration).toContain('STUDENT_ALREADY_HAS_IN_PROGRESS_LESSON');
    expect(migration).toContain('INSTRUCTOR_ALREADY_HAS_IN_PROGRESS_LESSON');
  });

  it('registra check-in, início e conclusão como notificações idempotentes', () => {
    expect(migration).toContain("'STUDENT_CHECKIN'");
    expect(migration).toContain("'PROVIDER_CHECKIN'");
    expect(migration).toContain("'LESSON_STARTED'");
    expect(migration).toContain("'LESSON_COMPLETED'");
    expect(migration).toContain('ON CONFLICT DO NOTHING');
    expect(migration).toContain('notify_booking_participants');
  });
});

import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  'supabase/migrations/20260906194822_task_094_school_controls_instant_instructor_status.sql',
  'utf8',
);
const providerApp = fs.readFileSync('src/apps/provider/ProviderApp.tsx', 'utf8');
const panel = fs.readFileSync('src/apps/provider/components/ProviderInstantLessonPanel.tsx', 'utf8');

describe('TASK-094 driving school Aula Agora instructor availability', () => {
  it('keeps status canonical per provider and instructor with one-hour windows', () => {
    expect(migration).toContain('provider_instant_instructor_status');
    expect(migration).toContain('p_provider_id UUID');
    expect(migration).toContain('p_instructor_id UUID');
    expect(migration).toContain('p_online BOOLEAN');
    expect(migration).toContain("v_online_expires_at := v_online_since + INTERVAL '1 hour'");
    expect(migration).toContain('online_since');
    expect(migration).toContain('online_expires_at');
    expect(migration).toContain("'INSTANT_INSTRUCTOR_AVAILABILITY_UPDATED'");
    expect(migration).toContain("'actor_user_id', v_actor_id");
  });

  it('authorizes only the instructor or the same-school management boundary', () => {
    expect(migration).toContain('v_actor_id <> p_instructor_id');
    expect(migration).toContain("v_provider_type = 'DRIVING_SCHOOL'::public.provider_type");
    expect(migration).toContain('public.can_manage_provider_schedule(p_provider_id)');
    expect(migration).toContain('dss.school_id = p_provider_id');
    expect(migration).toContain("dss.role = 'INSTRUCTOR'::public.user_role");
    expect(migration).toContain("RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SCOPE_DENIED'");
    expect(migration).toContain("RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SELF_ONLY'");
  });

  it('keeps school controls separate from vehicle settings in the UI', () => {
    expect(providerApp).toContain('schoolInstantInstructorOptions');
    expect(providerApp).toContain("hasPerm('school.schedule.manage')");
    expect(providerApp).toContain('canManageInstructorAvailability');
    expect(providerApp).toContain('user?.id === instructorId');
    expect(panel).toContain('availabilityInstructorOptions');
    expect(panel).toContain('canManageInstructorAvailability');
    expect(panel).toContain('Disponível por até 1h após a ativação.');
    expect(panel).not.toContain('Disponibilidade controlada pelo próprio instrutor.');
  });
});

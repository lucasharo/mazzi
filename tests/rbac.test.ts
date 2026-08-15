import { describe, it, expect } from 'vitest';
import { hasPermission, AppPermission } from '../src/domain/rbac';
import { UserRole } from '../src/types';

describe('Domain: RBAC Permissions Matrix', () => {
  it('ensures STUDENT has only student permissions and cannot manage vehicles or school finances', () => {
    const studentRole: UserRole = 'STUDENT';
    expect(hasPermission(studentRole, 'student.profile.read')).toBe(true);
    expect(hasPermission(studentRole, 'student.booking.create')).toBe(true);
    expect(hasPermission(studentRole, 'student.review.create')).toBe(true);

    // Negative security checks (Student cannot do administrative actions)
    expect(hasPermission(studentRole, 'school.schedule.manage')).toBe(false);
    expect(hasPermission(studentRole, 'school.vehicle.manage')).toBe(false);
    expect(hasPermission(studentRole, 'school.finance.read')).toBe(false);
    expect(hasPermission(studentRole, 'admin.compliance.review')).toBe(false);
    expect(hasPermission(studentRole, 'provider.payout.request')).toBe(false);
  });

  it('ensures INSTRUCTOR can manage own schedule and vehicles but not school staff or compliance review', () => {
    const instructorRole: UserRole = 'INSTRUCTOR';
    expect(hasPermission(instructorRole, 'provider.schedule.manage_own')).toBe(true);
    expect(hasPermission(instructorRole, 'provider.vehicle.manage_own')).toBe(true);
    expect(hasPermission(instructorRole, 'provider.finance.read_own')).toBe(true);
    expect(hasPermission(instructorRole, 'provider.payout.request')).toBe(true);
    expect(hasPermission(instructorRole, 'provider.lesson.start_finish')).toBe(true);

    expect(hasPermission(instructorRole, 'school.member.manage')).toBe(false);
    expect(hasPermission(instructorRole, 'admin.compliance.review')).toBe(false);
  });

  it('ensures SCHOOL_STAFF (secretary) cannot request payouts or view audit logs', () => {
    const staffRole: UserRole = 'SCHOOL_STAFF';
    expect(hasPermission(staffRole, 'school.schedule.manage')).toBe(true);
    expect(hasPermission(staffRole, 'school.vehicle.manage')).toBe(true);

    // Staff cannot perform financial withdrawal or view platform compliance
    expect(hasPermission(staffRole, 'school.payout.request')).toBe(false);
    expect(hasPermission(staffRole, 'admin.audit.read')).toBe(false);
    expect(hasPermission(staffRole, 'admin.compliance.review')).toBe(false);
  });

  it('ensures PLATFORM_ADMIN can review compliance documents and view audit logs', () => {
    const adminRole: UserRole = 'PLATFORM_ADMIN';
    expect(hasPermission(adminRole, 'admin.compliance.review')).toBe(true);
    expect(hasPermission(adminRole, 'admin.audit.read')).toBe(true);
    expect(hasPermission(adminRole, 'admin.platform.manage_settings')).toBe(true);
  });
});

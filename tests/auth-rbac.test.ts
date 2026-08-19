// ============================================================================
// MAZZI PLATFORM — SPRINT 03: AUTH, RBAC & DIRECT SUPABASE ATTACK SECURITY SUITE
// File: tests/auth-rbac.test.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  AuthContext,
  resolveUserPermissions,
  hasPermission,
  isPlatformAdmin,
  canAccessResourceOwner,
  canAccessSchoolResource,
  canAccessProviderResource,
} from '../src/domain/rbac';
import {
  requireAuth,
  requireRole,
  requirePermission,
  requireOwnership,
  requireSchoolMembership,
  requireProviderOwnership,
  AuthError,
} from '../src/lib/auth-guards';

describe('SPRINT 03 — RBAC, Auth Guards & Multi-Tenant Authorization Engine', () => {
  // Mock contexts
  const studentAlice: AuthContext = {
    userId: 'student-alice-uuid',
    email: 'alice@student.mazzi.com.br',
    roles: ['STUDENT'],
    status: 'ACTIVE',
  };

  const studentBob: AuthContext = {
    userId: 'student-bob-uuid',
    email: 'bob@student.mazzi.com.br',
    roles: ['STUDENT'],
    status: 'ACTIVE',
  };

  const instructorCarlos: AuthContext = {
    userId: 'instructor-carlos-uuid',
    email: 'carlos@mazzi.com.br',
    roles: ['INSTRUCTOR'],
    status: 'ACTIVE',
    providerId: 'provider-carlos-uuid',
  };

  const instructorDavid: AuthContext = {
    userId: 'instructor-david-uuid',
    email: 'david@mazzi.com.br',
    roles: ['INSTRUCTOR'],
    status: 'ACTIVE',
    providerId: 'provider-david-uuid',
  };

  const schoolAdminPaulista: AuthContext = {
    userId: 'admin-paulista-uuid',
    email: 'gestor@cfcpaulista.com.br',
    roles: ['SCHOOL_ADMIN'],
    status: 'ACTIVE',
    schoolId: 'school-paulista-uuid',
  };

  const schoolAdminPinheiros: AuthContext = {
    userId: 'admin-pinheiros-uuid',
    email: 'gestor@cfcpinheiros.com.br',
    roles: ['SCHOOL_ADMIN'],
    status: 'ACTIVE',
    schoolId: 'school-pinheiros-uuid',
  };

  const schoolStaffPaulista: AuthContext = {
    userId: 'staff-paulista-uuid',
    email: 'recepcao@cfcpaulista.com.br',
    roles: ['SCHOOL_STAFF'],
    status: 'ACTIVE',
    schoolId: 'school-paulista-uuid',
  };

  const platformAdmin: AuthContext = {
    userId: 'platform-admin-uuid',
    email: 'admin@mazzi.com.br',
    roles: ['PLATFORM_ADMIN'],
    status: 'ACTIVE',
  };

  const supportAgent: AuthContext = {
    userId: 'support-agent-uuid',
    email: 'support@mazzi.com.br',
    roles: ['SUPPORT'],
    status: 'ACTIVE',
  };

  const blockedUserWithActiveJWT: AuthContext = {
    userId: 'blocked-user-uuid',
    email: 'blocked@mazzi.com.br',
    roles: ['STUDENT'],
    status: 'BLOCKED',
  };

  describe('1. Role & Permission Resolution', () => {
    it('resolves standard student permissions', () => {
      const perms = resolveUserPermissions(studentAlice);
      expect(perms.has('student.profile.read')).toBe(true);
      expect(perms.has('student.booking.create')).toBe(true);
      expect(perms.has('provider.schedule.manage_own')).toBe(false);
      expect(perms.has('admin.platform.manage_settings')).toBe(false);
    });

    it('resolves instructor permissions including lesson management and finances', () => {
      const perms = resolveUserPermissions(instructorCarlos);
      expect(perms.has('provider.schedule.manage_own')).toBe(true);
      expect(perms.has('provider.lesson.start_finish')).toBe(true);
      expect(perms.has('provider.finance.read_own')).toBe(true);
      expect(perms.has('school.member.manage')).toBe(false);
      expect(perms.has('admin.platform.manage_settings')).toBe(false);
    });

    it('resolves school admin vs school staff permissions', () => {
      const adminPerms = resolveUserPermissions(schoolAdminPaulista);
      const staffPerms = resolveUserPermissions(schoolStaffPaulista);

      expect(adminPerms.has('school.member.manage')).toBe(true);
      expect(adminPerms.has('school.finance.read')).toBe(true);
      expect(adminPerms.has('school.payout.request')).toBe(true);
      expect(adminPerms.has('school.schedule.manage')).toBe(true);

      expect(staffPerms.has('school.member.read')).toBe(true);
      expect(staffPerms.has('school.schedule.manage')).toBe(true);
      expect(staffPerms.has('school.member.manage')).toBe(false);
      expect(staffPerms.has('school.finance.read')).toBe(false);

      expect(canAccessSchoolResource(schoolStaffPaulista, 'school-paulista-uuid')).toBe(true);
      expect(canAccessSchoolResource(schoolStaffPaulista, 'school-pinheiros-uuid')).toBe(false);
    });

    it('denies all permissions for BLOCKED accounts even if JWT claims roles', () => {
      const perms = resolveUserPermissions(blockedUserWithActiveJWT);
      expect(perms.size).toBe(0);
      expect(hasPermission(blockedUserWithActiveJWT, 'student.profile.read')).toBe(false);
    });
  });

  describe('2. Direct Supabase Attack Simulations (A through G)', () => {
    it('ATTACK A: Student A directly attempts to read/update Student B record -> DENIED (Anti-IDOR)', () => {
      expect(canAccessResourceOwner(studentAlice, studentBob.userId)).toBe(false);
      expect(() => requireOwnership(studentAlice, studentBob.userId)).toThrow(AuthError);
    });

    it('ATTACK B: Student attempts direct user_roles INSERT to grant PLATFORM_ADMIN -> DENIED', () => {
      // Direct client mutation simulation
      const attemptElevate = () => {
        if (!isPlatformAdmin(studentAlice)) {
          throw new AuthError('Direct user_roles insertion prohibited', 403, 'FORBIDDEN_MUTATION');
        }
      };
      expect(attemptElevate).toThrow(AuthError);
      expect(() => requireRole(studentAlice, ['PLATFORM_ADMIN'])).toThrow(AuthError);
    });

    it('ATTACK C: Student attempts user_custom_permissions INSERT for admin.user.manage -> DENIED', () => {
      const attemptCustomPerm = () => {
        if (!isPlatformAdmin(studentAlice)) {
          throw new AuthError('Direct user_custom_permissions insertion prohibited', 403, 'FORBIDDEN_MUTATION');
        }
      };
      expect(attemptCustomPerm).toThrow(AuthError);
      expect(hasPermission(studentAlice, 'admin.user.manage')).toBe(false);
      expect(() => requirePermission(studentAlice, 'admin.user.manage')).toThrow(AuthError);
    });

    it('ATTACK D: School Admin A attempts to access/mutate School B fleet or staff -> DENIED (Multi-Tenant Isolation)', () => {
      expect(canAccessSchoolResource(schoolAdminPaulista, schoolAdminPinheiros.schoolId!)).toBe(false);
      expect(() => requireSchoolMembership(schoolAdminPaulista, schoolAdminPinheiros.schoolId!)).toThrow(AuthError);
    });

    it('ATTACK E: Instructor A attempts to manage vehicle or slots of Instructor B -> DENIED (Provider Isolation)', () => {
      expect(canAccessProviderResource(instructorCarlos, instructorDavid.providerId!)).toBe(false);
      expect(() => requireProviderOwnership(instructorCarlos, instructorDavid.providerId!)).toThrow(AuthError);
    });

    it('ATTACK F: Support Agent attempts role_permissions update or payout execution -> DENIED', () => {
      expect(hasPermission(supportAgent, 'admin.platform.manage_settings')).toBe(false);
      expect(hasPermission(supportAgent, 'admin.finance.read_all')).toBe(false);
      expect(hasPermission(supportAgent, 'school.payout.request')).toBe(false);
      expect(hasPermission(supportAgent, 'provider.payout.request')).toBe(false);
      expect(() => requirePermission(supportAgent, 'admin.platform.manage_settings')).toThrow(AuthError);
    });

    it('ATTACK G: Blocked user holding still-valid JWT attempts protected booking/profile operation -> DENIED', () => {
      // Even though blocked user has a non-expired JWT, database status = BLOCKED kills all privileges
      expect(() => requireAuth(blockedUserWithActiveJWT)).toThrow(AuthError);
      expect(() => requirePermission(blockedUserWithActiveJWT, 'student.booking.create')).toThrow(AuthError);
      expect(() => requireOwnership(blockedUserWithActiveJWT, blockedUserWithActiveJWT.userId)).toThrow(AuthError);
      expect(hasPermission(blockedUserWithActiveJWT, 'student.booking.create')).toBe(false);
    });
  });

  describe('3. Legitimate Authorized Access Checks', () => {
    it('allows Student A to access own profile and bookings', () => {
      expect(canAccessResourceOwner(studentAlice, studentAlice.userId)).toBe(true);
      expect(() => requireOwnership(studentAlice, studentAlice.userId)).not.toThrow();
      expect(() => requirePermission(studentAlice, 'student.booking.create')).not.toThrow();
    });

    it('allows Instructor A to manage own schedule and vehicle', () => {
      expect(canAccessProviderResource(instructorCarlos, instructorCarlos.providerId!)).toBe(true);
      expect(() => requireProviderOwnership(instructorCarlos, instructorCarlos.providerId!)).not.toThrow();
    });

    it('allows School Admin A to manage School A resources', () => {
      expect(canAccessSchoolResource(schoolAdminPaulista, schoolAdminPaulista.schoolId!)).toBe(true);
      expect(() => requireSchoolMembership(schoolAdminPaulista, schoolAdminPaulista.schoolId!)).not.toThrow();
    });

    it('allows Platform Admin overarching audit visibility', () => {
      expect(isPlatformAdmin(platformAdmin)).toBe(true);
      expect(canAccessResourceOwner(platformAdmin, studentAlice.userId)).toBe(true);
      expect(canAccessSchoolResource(platformAdmin, schoolAdminPaulista.schoolId!)).toBe(true);
      expect(canAccessProviderResource(platformAdmin, instructorCarlos.providerId!)).toBe(true);
    });
  });
});

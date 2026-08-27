// ============================================================================
// MAZZI PLATFORM — SPRINT 03: RBAC & AUTHORIZATION CORE ENGINE
// File: src/domain/rbac.ts
// ============================================================================

import { UserRole } from '../types';

export type AppPermission =
  // Student domain
  | 'student.profile.read'
  | 'student.profile.update'
  | 'student.booking.create'
  | 'student.booking.read_own'
  | 'student.booking.cancel_own'
  | 'student.review.create'

  // Provider / Instructor domain
  | 'provider.profile.read_own'
  | 'provider.profile.update_own'
  | 'provider.schedule.manage_own'
  | 'provider.vehicle.manage_own'
  | 'provider.lesson.start_finish'
  | 'provider.finance.read_own'
  | 'provider.payout.request'

  // Driving School domain (Multi-tenant)
  | 'school.profile.read'
  | 'school.profile.update'
  | 'school.member.read'
  | 'school.member.manage'
  | 'school.vehicle.manage'
  | 'school.schedule.manage'
  | 'school.finance.read'
  | 'school.payout.request'

  // Platform Admin domain
  | 'admin.provider.review'
  | 'admin.provider.suspend'
  | 'admin.compliance.review'
  | 'admin.platform.manage_settings'
  | 'admin.audit.read'
  | 'admin.finance.read_all'
  | 'admin.user.manage'

  // Support domain
  | 'support.user.read_limited'
  | 'support.booking.read_limited'
  | 'support.ticket.manage';

// Legacy Permission alias for backward compatibility
export type Permission = AppPermission;

export type UserAccountStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'BLOCKED';

export interface AuthContext {
  userId: string;
  email: string;
  roles: UserRole[];
  status: UserAccountStatus;
  providerId?: string | null;
  schoolId?: string | null;
  customPermissions?: {
    granted: AppPermission[];
    revoked: AppPermission[];
  };
}

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, readonly AppPermission[]> = {
  STUDENT: [
    'student.profile.read',
    'student.profile.update',
    'student.booking.create',
    'student.booking.read_own',
    'student.booking.cancel_own',
    'student.review.create',
  ],
  INSTRUCTOR: [
    'student.profile.read',
    'provider.profile.read_own',
    'provider.profile.update_own',
    'provider.schedule.manage_own',
    'provider.vehicle.manage_own',
    'provider.lesson.start_finish',
    'provider.finance.read_own',
    'provider.payout.request',
  ],
  DRIVING_SCHOOL: [
    'school.profile.read',
    'school.profile.update',
    'school.member.read',
    'school.member.manage',
    'school.vehicle.manage',
    'school.schedule.manage',
    'school.finance.read',
    'school.payout.request',
  ],
  SCHOOL_ADMIN: [
    'school.profile.read',
    'school.profile.update',
    'school.member.read',
    'school.member.manage',
    'school.vehicle.manage',
    'school.schedule.manage',
    'school.finance.read',
    'school.payout.request',
    'provider.lesson.start_finish',
  ],
  SCHOOL_STAFF: [
    'school.profile.read',
    'school.member.read',
    'school.vehicle.manage',
    'school.schedule.manage',
  ],
  PLATFORM_ADMIN: [
    'admin.provider.review',
    'admin.provider.suspend',
    'admin.compliance.review',
    'admin.platform.manage_settings',
    'admin.audit.read',
    'admin.finance.read_all',
    'admin.user.manage',
    'support.user.read_limited',
    'support.booking.read_limited',
  ],
  SUPPORT: [
    'support.user.read_limited',
    'support.booking.read_limited',
    'support.ticket.manage',
    'admin.audit.read',
  ],
};

/**
 * Resolves the aggregated set of permissions for a user given their roles and overrides
 */
export function resolveUserPermissions(context: AuthContext | UserRole): Set<AppPermission> {
  // If a single UserRole is passed directly
  if (typeof context === 'string') {
    const rolePerms = ROLE_DEFAULT_PERMISSIONS[context] || [];
    return new Set(rolePerms);
  }

  // BLOCKED users have 0 permissions
  if (context.status === 'BLOCKED') {
    return new Set();
  }

  const permissions = new Set<AppPermission>();

  // 1. Add base permissions from all assigned roles
  if (Array.isArray(context.roles)) {
    for (const role of context.roles) {
      const rolePerms = ROLE_DEFAULT_PERMISSIONS[role] || [];
      for (const p of rolePerms) {
        permissions.add(p);
      }
    }
  }

  // 2. Add custom granted permissions
  if (context.customPermissions?.granted) {
    for (const p of context.customPermissions.granted) {
      permissions.add(p);
    }
  }

  // 3. Remove custom revoked permissions
  if (context.customPermissions?.revoked) {
    for (const p of context.customPermissions.revoked) {
      permissions.delete(p);
    }
  }

  return permissions;
}

/**
 * Checks if the authentication context or single role has the required permission
 */
export function hasPermission(context: AuthContext | UserRole, permission: AppPermission): boolean {
  if (typeof context !== 'string' && context.status === 'BLOCKED') {
    return false;
  }
  const resolved = resolveUserPermissions(context);
  return resolved.has(permission);
}

/**
 * Checks if the user is a platform admin
 */
export function isPlatformAdmin(context: AuthContext): boolean {
  return context.status === 'ACTIVE' && context.roles.includes('PLATFORM_ADMIN');
}

/**
 * Enforces resource ownership (Anti-IDOR)
 * Student A cannot access Student B
 */
export function canAccessResourceOwner(context: AuthContext, resourceOwnerUserId: string): boolean {
  if (context.status === 'BLOCKED') return false;
  if (isPlatformAdmin(context)) return true;
  return context.userId === resourceOwnerUserId;
}

/**
 * Enforces Multi-tenant isolation for Driving Schools
 * Autoescola A never accesses Autoescola B
 */
export function canAccessSchoolResource(context: AuthContext, resourceSchoolId: string): boolean {
  if (context.status === 'BLOCKED') return false;
  if (isPlatformAdmin(context)) return true;
  if (!context.schoolId) return false;
  return context.schoolId === resourceSchoolId;
}

/**
 * Enforces Provider ownership
 * Instructor A cannot modify Instructor B's agenda/vehicles
 */
export function canAccessProviderResource(context: AuthContext, resourceProviderId: string): boolean {
  if (context.status === 'BLOCKED') return false;
  if (isPlatformAdmin(context)) return true;
  if (context.providerId && context.providerId === resourceProviderId) return true;
  if (context.schoolId && context.schoolId === resourceProviderId) return true;
  return false;
}

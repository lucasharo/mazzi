// ============================================================================
// MAZZI PLATFORM — SPRINT 03: AUTH & RBAC GUARDS (BACKEND SOURCE OF TRUTH)
// File: src/lib/auth-guards.ts
// ============================================================================

import { AuthContext, AppPermission, hasPermission, isPlatformAdmin, canAccessResourceOwner, canAccessSchoolResource, canAccessProviderResource } from '../domain/rbac';
import { UserRole } from '../types';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code: string = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Enforces that a valid authenticated context is present and active
 */
export function requireAuth(context: AuthContext | null | undefined): AuthContext {
  if (!context || !context.userId) {
    throw new AuthError('Autenticação necessária para acessar este recurso', 401, 'UNAUTHENTICATED');
  }

  if (context.status === 'BLOCKED') {
    throw new AuthError('Conta bloqueada por razões de segurança ou compliance', 403, 'ACCOUNT_BLOCKED');
  }

  return context;
}

/**
 * Enforces that the authenticated user possesses at least one of the specified roles
 */
export function requireRole(context: AuthContext | null | undefined, allowedRoles: UserRole[]): AuthContext {
  const auth = requireAuth(context);

  const hasAnyRole = auth.roles.some((role) => allowedRoles.includes(role));
  if (!hasAnyRole) {
    throw new AuthError(
      `Acesso negado: Perfil incompatível com os papéis necessários [${allowedRoles.join(', ')}]`,
      403,
      'FORBIDDEN_ROLE'
    );
  }

  return auth;
}

/**
 * Enforces that the user context has a specific fine-grained permission
 */
export function requirePermission(context: AuthContext | null | undefined, permission: AppPermission): AuthContext {
  const auth = requireAuth(context);

  if (!hasPermission(auth, permission)) {
    throw new AuthError(
      `Acesso negado: Permissão [${permission}] necessária não concedida`,
      403,
      'FORBIDDEN_PERMISSION'
    );
  }

  return auth;
}

/**
 * Enforces Resource Ownership (Anti-IDOR)
 * Student A cannot access Student B's profile, lessons, or payment intents
 */
export function requireOwnership(
  context: AuthContext | null | undefined,
  resourceOwnerUserId: string,
  permission?: AppPermission
): AuthContext {
  const auth = requireAuth(context);

  if (permission && !hasPermission(auth, permission)) {
    throw new AuthError(`Permissão [${permission}] ausente`, 403, 'FORBIDDEN_PERMISSION');
  }

  if (!canAccessResourceOwner(auth, resourceOwnerUserId)) {
    throw new AuthError(
      'Acesso negado: Você não possui autorização para acessar recursos de outro usuário (IDOR)',
      403,
      'IDOR_VIOLATION'
    );
  }

  return auth;
}

/**
 * Enforces Multi-tenant isolation for Autoescolas / CFCs
 * School Admin / Staff from School A cannot access members, fleet or financial data from School B
 */
export function requireSchoolMembership(
  context: AuthContext | null | undefined,
  targetSchoolId: string,
  requiredRole?: 'SCHOOL_ADMIN' | 'SCHOOL_STAFF'
): AuthContext {
  const auth = requireAuth(context);

  if (isPlatformAdmin(auth)) {
    return auth;
  }

  if (requiredRole && !auth.roles.includes(requiredRole) && !auth.roles.includes('SCHOOL_ADMIN')) {
    throw new AuthError(`Acesso negado: Requer papel administrativo de autoescola`, 403, 'FORBIDDEN_ROLE');
  }

  if (!canAccessSchoolResource(auth, targetSchoolId)) {
    throw new AuthError(
      'Isolamento multi-tenant violado: Você não pertence à autoescola solicitada',
      403,
      'MULTI_TENANT_VIOLATION'
    );
  }

  return auth;
}

/**
 * Enforces Provider ownership (Instructors / CFCs)
 */
export function requireProviderOwnership(
  context: AuthContext | null | undefined,
  targetProviderId: string
): AuthContext {
  const auth = requireAuth(context);

  if (!canAccessProviderResource(auth, targetProviderId)) {
    throw new AuthError(
      'Acesso negado: Você não é o titular deste perfil de instrutor/prestador',
      403,
      'PROVIDER_ISOLATION_VIOLATION'
    );
  }

  return auth;
}

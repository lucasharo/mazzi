// ============================================================================
// MAZZI PLATFORM — SPRINT 03: AUTH SERVICE (FRONTEND & BACKEND ORCHESTRATOR)
// File: src/lib/auth-service.ts
// ============================================================================

import { supabase } from './supabase';
import { AuthContext, AppPermission, resolveUserPermissions } from '../domain/rbac';
import { UserRole } from '../types';

export interface AuthSessionState {
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    roles: UserRole[];
    status: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'BLOCKED';
    avatarUrl?: string;
    providerId?: string;
    schoolId?: string;
  } | null;
  permissions: AppPermission[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

/**
 * Normalizes an AuthContext object from active session state
 */
export function buildAuthContext(session: AuthSessionState): AuthContext | null {
  if (!session.user || !session.isAuthenticated) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    roles: session.user.roles,
    status: session.user.status,
    providerId: session.user.providerId,
    schoolId: session.user.schoolId,
  };
}

/**
 * Sign up a new Student (Public standard flow)
 * Default role is strictly STUDENT. Admin/Support roles cannot be selected.
 */
export async function signUpStudent({ email, password, name, phone }: SignUpParams) {
  // In development without live Supabase cloud, provide deterministic mockup behavior
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        role: 'STUDENT', // Hardcoded default public signup
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail({ email, password }: SignInParams) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Trigger password reset request (Forgot Password)
 */
export async function requestPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update password (Reset Password)
 */
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('SignOut error:', error);
  }
}

// ============================================================================
// MAZZI PLATFORM — AUTH SERVICE (SUPABASE AUTH ORCHESTRATOR)
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
    cpf?: string;
    birthDate?: string;
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
  cpf: string;
  birthDate: string; // YYYY-MM-DD
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
export async function signUpStudent({ email, password, name, phone, cpf, birthDate }: SignUpParams) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        cpf,
        birth_date: birthDate,
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
 * Verify 6-digit OTP for email confirmation (Signup)
 */
export async function verifyEmailOtp({ email, token }: { email: string; token: string }) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Re-send signup verification OTP
 */
export async function resendSignupOtp(email: string) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email,
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
 * Trigger password reset request (Sends 6-digit OTP to user email)
 */
export async function requestPasswordReset(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Verify 6-digit OTP for password recovery
 */
export async function verifyRecoveryOtp({ email, token }: { email: string; token: string }) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'recovery',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update password (Reset Password with active session)
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

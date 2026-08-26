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
    providerStatus?: string;
    schoolId?: string;
  } | null;
  permissions: AppPermission[];
  isAuthenticated: boolean;
  recoveryInProgress: boolean;
  isInstructorOnboarding: boolean;
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
export async function signUpPublicAccount({ email, password, name, phone, cpf, birthDate }: SignUpParams) {
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

/** Backward-compatible name for the student public signup flow. */
export const signUpStudent = signUpPublicAccount;

/**
 * Completes the authenticated instructor onboarding without accepting a role
 * or provider id from the browser. The database RPC derives the identity from
 * auth.uid(), validates the existing profile, grants only INSTRUCTOR, and
 * creates an initial non-public provider profile idempotently.
 */
export async function onboardInstructor() {
  const { data, error } = await supabase.rpc('onboard_my_instructor');
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export interface DrivingSchoolOnboardingParams {
  cnpj: string;
  legalName: string;
  tradeName: string;
  phone: string;
  commercialEmail: string;
  postalCode: string;
  address: Record<string, unknown>;
  latitude: number;
  longitude: number;
}

/**
 * Creates or resumes the authenticated person's driving-school workspace.
 * The RPC derives auth.uid() and grants SCHOOL_ADMIN server-side, so the
 * browser never supplies a user, school, or role identifier.
 */
export async function onboardDrivingSchool(params: DrivingSchoolOnboardingParams) {
  // Generated database types are updated with the next schema refresh; keep
  // this typed public boundary while the forward-only migration is pending.
  const { data, error } = await (supabase as any).rpc('onboard_my_driving_school', {
    p_cnpj: params.cnpj,
    p_legal_name: params.legalName,
    p_trade_name: params.tradeName,
    p_phone: params.phone,
    p_commercial_email: params.commercialEmail,
    p_postal_code: params.postalCode,
    p_address: params.address,
    p_latitude: params.latitude,
    p_longitude: params.longitude,
  });
  if (error) throw new Error(error.message);
  return data;
}

export interface StudentToProMigrationStatus {
  student_profile_active: boolean;
  instructor_role_active: boolean;
  provider_id: string | null;
  provider_status: string | null;
  can_migrate: boolean;
  blockers: string[];
  active_booking_count: number;
}

export async function getStudentToProMigrationStatus(): Promise<StudentToProMigrationStatus> {
  const { data, error } = await supabase.rpc('get_my_student_to_pro_migration_status');
  if (error) throw new Error(error.message);
  return data as StudentToProMigrationStatus;
}

export async function migrateStudentProfileToInstructor() {
  const { data, error } = await supabase.rpc('migrate_my_student_profile_to_instructor');
  if (error) throw new Error(error.message);
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

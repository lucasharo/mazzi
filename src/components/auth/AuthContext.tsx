// ============================================================================
// MAZZI PLATFORM — SPRINT 11.5: REAL SUPABASE AUTHENTICATION INTEGRATION
// File: src/components/auth/AuthContext.tsx
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserRole } from '../../types';
import { AppPermission, resolveUserPermissions } from '../../domain/rbac';
import { AuthSessionState } from '../../lib/auth-service';
import { onboardDrivingSchool as onboardDrivingSchoolService, onboardInstructor as onboardInstructorService, getStudentToProMigrationStatus as getStudentToProMigrationStatusService, migrateStudentProfileToInstructor as migrateStudentProfileToInstructorService, signInWithEmail, signUpPublicAccount as signUpPublicAccountService, type DrivingSchoolOnboardingParams, type SignUpParams, type StudentToProMigrationStatus } from '../../lib/auth-service';
import { supabase } from '../../lib/supabase';

interface AuthContextType extends AuthSessionState {
  signIn: (email: string, password: string) => Promise<void>;
  signUpPublicAccount: (params: SignUpParams) => ReturnType<typeof signUpPublicAccountService>;
  signUpStudent: (params: SignUpParams) => ReturnType<typeof signUpPublicAccountService>;
  beginInstructorOnboarding: () => void;
  cancelInstructorOnboarding: () => void;
  onboardInstructor: (options?: { keepOnboarding?: boolean }) => Promise<Awaited<ReturnType<typeof onboardInstructorService>>>;
  onboardDrivingSchool: (params: DrivingSchoolOnboardingParams) => Promise<Awaited<ReturnType<typeof onboardDrivingSchoolService>>>;
  completeInstructorOnboarding: () => void;
  getStudentToProMigrationStatus: () => Promise<StudentToProMigrationStatus>;
  migrateStudentProfileToInstructor: () => Promise<Awaited<ReturnType<typeof migrateStudentProfileToInstructorService>>>;
  logout: () => Promise<void>;
  beginPasswordRecovery: () => void;
  completePasswordRecovery: () => Promise<void>;
  hasPerm: (permission: AppPermission) => boolean;
}

const AuthContextReact = createContext<AuthContextType | undefined>(undefined);
const INSTRUCTOR_ONBOARDING_STORAGE_KEY = 'mazzi.instructor-onboarding.pending';

function hasPendingInstructorOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(INSTRUCTOR_ONBOARDING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function setPendingInstructorOnboarding(pending: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (pending) window.sessionStorage.setItem(INSTRUCTOR_ONBOARDING_STORAGE_KEY, 'true');
    else window.sessionStorage.removeItem(INSTRUCTOR_ONBOARDING_STORAGE_KEY);
  } catch {
    // The in-memory gate remains authoritative when session storage is unavailable.
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthSessionState>({
    user: null,
    permissions: [],
    isAuthenticated: false,
    recoveryInProgress: false,
    isInstructorOnboarding: false,
    isLoading: true,
    error: null,
  });

  const recoveryInProgressRef = useRef(false);
  const instructorOnboardingRef = useRef(hasPendingInstructorOnboarding());
  const inFlightSessionHydrationRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const beginPasswordRecovery = () => {
    recoveryInProgressRef.current = true;
    setAuthState(prev => ({
      ...prev,
      user: null,
      permissions: [],
      isAuthenticated: false,
      recoveryInProgress: true,
      isInstructorOnboarding: false,
      isLoading: false,
      error: null,
    }));
  };

  const completePasswordRecovery = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    recoveryInProgressRef.current = false;
    setAuthState({
      user: null,
      permissions: [],
      isAuthenticated: false,
      recoveryInProgress: false,
      isInstructorOnboarding: false,
      isLoading: false,
      error: null,
    });
  };

  const hydrateSession = async (session: any) => {
    if (recoveryInProgressRef.current) {
      setAuthState(prev => ({
        ...prev,
        user: null,
        permissions: [],
        isAuthenticated: false,
        recoveryInProgress: true,
        isInstructorOnboarding: instructorOnboardingRef.current,
        isLoading: false,
        error: null,
      }));
      return;
    }

    if (!session?.user) {
      setAuthState({
        user: null,
        permissions: [],
        isAuthenticated: false,
        recoveryInProgress: false,
        isInstructorOnboarding: instructorOnboardingRef.current,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      const sp = supabase as any;

      // 0. Validate Auth User using getUser() to prevent stale session attacks
      const { data: { user: authUser }, error: authErr } = await sp.auth.getUser();
      
      if ((import.meta as any).env?.DEV) {
        console.debug('[MAZZI_AUTH_DEBUG]', {
          hasSessionUser: !!session?.user?.id,
          hasValidatedUser: !!authUser?.id,
        });
      }

      if (authErr || !authUser) {
        console.warn('STALE_SESSION_DETECTED: Auth user invalid or expired, signing out locally');
        await sp.auth.signOut({ scope: 'local' }).catch(() => {});
        setAuthState({
          user: null,
          permissions: [],
          isAuthenticated: false,
          recoveryInProgress: false,
          isInstructorOnboarding: false,
          isLoading: false,
          error: 'Sua sessão expirou. Entre novamente.',
        });
        return;
      }

      const user = authUser;
      const email = user.email || '';
      const profileQueryUserId = user.id;

      // 1. Fetch profile from public.users table
      let { data: profile, error: profileErr } = await sp
        .from('users')
        .select('*')
        .eq('id', profileQueryUserId)
        .maybeSingle();

      const profileFound = !!profile;
      if ((import.meta as any).env?.DEV) {
        console.debug('[MAZZI_PROFILE_DEBUG]', {
          profileFound,
          profileInsertAttempted: false,
        });
      }

      // Ensure DB profile exists ONLY for legitimate new student registrations.
      // Pre-provisioned users (instructors, admins, school staff, existing students) MUST already exist in public.users.
      if (!profile) {
        const role = user.user_metadata?.role || 'STUDENT';
        
        // Strict guard: Never auto-create profiles for privileged or pre-provisioned roles!
        if (role !== 'STUDENT') {
          console.error('AUTH_PROFILE_NOT_PROVISIONED: Non-student role missing profile in public.users', { role, userId: user.id });
          await sp.auth.signOut({ scope: 'local' }).catch(() => {});
          setAuthState({
            user: null,
            permissions: [],
            isAuthenticated: false,
            recoveryInProgress: false,
            isInstructorOnboarding: false,
            isLoading: false,
            error: 'Perfil não provisionado para este usuário. Contate o suporte.',
          });
          return;
        }

        // Only bootstrap for brand new STUDENTS
        const name = user.user_metadata?.name || 'Novo Aluno';
        const phone = user.user_metadata?.phone || '';
        const cpf = user.user_metadata?.cpf || null;
        const birthDate = user.user_metadata?.birth_date || null;

        if ((import.meta as any).env?.DEV) {
          console.debug('[MAZZI_PROFILE_DEBUG]', {
            profileFound: false,
            profileInsertAttempted: true,
          });
        }

        const insertPayload: any = {
          id: user.id,
          email,
          name,
          phone,
          role: 'STUDENT',
          status: 'ACTIVE',
        };
        if (cpf) insertPayload.cpf = cpf;
        if (birthDate) insertPayload.birth_date = birthDate;

        const { data: insertedProfile, error: insertErr } = await sp
          .from('users')
          .insert(insertPayload)
          .select()
          .single();

        if (insertErr) {
          if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
            const { data: existingProfile } = await sp
              .from('users')
              .select('*')
              .eq('id', profileQueryUserId)
              .maybeSingle();
            if (existingProfile) {
              profile = existingProfile;
            } else {
              throw insertErr;
            }
          } else {
            console.error('Error auto-creating user profile:', insertErr);
            throw insertErr;
          }
        } else {
          profile = insertedProfile;
        }
      }

      const { data: roleRows, error: rolesError } = await sp.rpc('get_my_roles');
      if (rolesError) {
        throw new Error(`AUTH_ROLES_UNAVAILABLE: ${rolesError.message || 'Não foi possível carregar suas permissões.'}`);
      }
      const roles = Array.from(new Set<UserRole>([
        ...((roleRows || []).map((entry: { role: UserRole }) => entry.role)),
      ]));
      if (roles.length === 0) {
        throw new Error('AUTH_ROLES_UNAVAILABLE: Nenhuma role válida foi encontrada para esta conta.');
      }

      // 2. Fetch active provider details or school details if any (only for instructors or school admins)
      let providerId: string | undefined;
      let providerStatus: string | undefined;
      let schoolId: string | undefined;

      if (profile && roles.some((role) => ['INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF'].includes(role))) {
        const { data: providers } = await sp
          .from('providers')
          .select('id,status,type')
          .eq('user_id', profile.id);

        const { data: staffRows } = await sp
          .from('driving_school_staff')
          .select('school_id,role')
          .eq('user_id', profile.id);

        // A single human can own both an INSTRUCTOR and a DRIVING_SCHOOL
        // workspace. Prefer the owned school workspace for SCHOOL_ADMIN, then
        // fall back to the instructor profile without relying on maybeSingle().
        const ownedSchool = providers?.find((provider) => provider.type === 'DRIVING_SCHOOL');
        if (ownedSchool) schoolId = ownedSchool.id;
        const staff = staffRows?.find((entry) => entry.school_id === ownedSchool?.id) || staffRows?.[0];
        if (staff) schoolId = staff.school_id;
        const schoolProvider = schoolId ? providers?.find((provider) => provider.id === schoolId && provider.type === 'DRIVING_SCHOOL') : undefined;
        const instructorProvider = providers?.find((provider) => provider.type === 'INSTRUCTOR');
        const selectedProvider = roles.includes('SCHOOL_ADMIN') && schoolProvider ? schoolProvider : instructorProvider || schoolProvider;
        if (selectedProvider) {
          providerId = selectedProvider.id;
          providerStatus = selectedProvider.status;
        }
      }

      const mappedUser = {
        id: user.id,
        email,
        name: profile?.name || user.user_metadata?.name || 'Usuário',
        phone: profile?.phone || user.user_metadata?.phone || '',
        cpf: profile?.cpf || user.user_metadata?.cpf,
        birthDate: profile?.birth_date || user.user_metadata?.birth_date,
        studentSavedAddress: profile?.metadata?.student_saved_address || undefined,
        roles,
        status: (profile?.status || 'ACTIVE') as any,
        providerId,
        providerStatus,
        schoolId,
        professionalPath: user.user_metadata?.professional_path === 'school' ? 'school' : user.user_metadata?.professional_path === 'instructor' ? 'instructor' : undefined,
      };

      const permissions = Array.from(
        resolveUserPermissions({
          userId: mappedUser.id,
          email: mappedUser.email,
          roles: mappedUser.roles,
          status: mappedUser.status,
          providerId: mappedUser.providerId,
          schoolId: mappedUser.schoolId,
        })
      );

      setAuthState({
        user: mappedUser,
        permissions,
        isAuthenticated: true,
        recoveryInProgress: false,
        isInstructorOnboarding: instructorOnboardingRef.current,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to handle session hydration:', err);
      setAuthState({
        user: null,
        permissions: [],
        isAuthenticated: false,
        recoveryInProgress: false,
        isInstructorOnboarding: instructorOnboardingRef.current,
        isLoading: false,
        error: err.message || 'Erro ao carregar sessão',
      });
    }
  };

  const handleSession = async (session: any) => {
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
      await hydrateSession(session);
      return;
    }

    const inFlight = inFlightSessionHydrationRef.current;
    if (inFlight?.userId === userId) {
      await inFlight.promise;
      return;
    }

    const promise = hydrateSession(session);
    inFlightSessionHydrationRef.current = { userId, promise };
    try {
      await promise;
    } finally {
      if (inFlightSessionHydrationRef.current?.promise === promise) {
        inFlightSessionHydrationRef.current = null;
      }
    }
  };

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // 2. Listen for auth state transitions
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        beginPasswordRecovery();
      }
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user, session } = await signInWithEmail({ email, password });
      if (!user) throw new Error('A autenticação não retornou um usuário válido.');
      await handleSession(session || { user });
    } catch (err: any) {
      setAuthState(prev => ({ ...prev, isLoading: false, error: err?.message || 'Falha ao autenticar.' }));
      throw err;
    }
  };

  const beginInstructorOnboarding = () => {
    instructorOnboardingRef.current = true;
    setPendingInstructorOnboarding(true);
    setAuthState((prev) => ({ ...prev, isInstructorOnboarding: true, error: null }));
  };

  const cancelInstructorOnboarding = () => {
    instructorOnboardingRef.current = false;
    setPendingInstructorOnboarding(false);
    setAuthState((prev) => ({ ...prev, isInstructorOnboarding: false }));
  };

  const signUpPublicAccount = (params: SignUpParams) => signUpPublicAccountService(params);
  const signUpStudent = (params: SignUpParams) => signUpPublicAccountService(params);
  const onboardInstructor = async ({ keepOnboarding = false }: { keepOnboarding?: boolean } = {}) => {
    try {
      const result = await onboardInstructorService();
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        throw new Error('AUTH_SESSION_UNAVAILABLE: Não foi possível reidratar a sessão do instrutor.');
      }
      if (!keepOnboarding) {
        instructorOnboardingRef.current = false;
        setPendingInstructorOnboarding(false);
      }
      await handleSession(session);
      return result;
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isInstructorOnboarding: true, isLoading: false }));
      throw error;
    }
  };

  const onboardDrivingSchool = async (params: DrivingSchoolOnboardingParams) => {
    const result = await onboardDrivingSchoolService(params);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) throw new Error('AUTH_SESSION_UNAVAILABLE: Não foi possível reidratar a sessão da autoescola.');
    await handleSession(session);
    return result;
  };

  const completeInstructorOnboarding = () => {
    instructorOnboardingRef.current = false;
    setPendingInstructorOnboarding(false);
    setAuthState((prev) => ({ ...prev, isInstructorOnboarding: false, error: null }));
  };

  const getStudentToProMigrationStatus = () => getStudentToProMigrationStatusService();
  const migrateStudentProfileToInstructor = async () => {
    const result = await migrateStudentProfileToInstructorService();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) throw new Error('AUTH_SESSION_UNAVAILABLE: Não foi possível reidratar sua sessão.');
    await handleSession(session);
    return result;
  };

  const logout = async () => {
    instructorOnboardingRef.current = false;
    setPendingInstructorOnboarding(false);
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setAuthState({
        user: null,
        permissions: [],
        isAuthenticated: false,
        recoveryInProgress: false,
        isInstructorOnboarding: false,
        isLoading: false,
        error: null,
      });
    }
  };

  const hasPerm = (permission: AppPermission): boolean => {
    return authState.permissions.includes(permission);
  };

  return (
    <AuthContextReact.Provider
      value={{
        ...authState,
        signIn,
        signUpPublicAccount,
        signUpStudent,
        beginInstructorOnboarding,
        cancelInstructorOnboarding,
        onboardInstructor,
        onboardDrivingSchool,
        completeInstructorOnboarding,
        getStudentToProMigrationStatus,
        migrateStudentProfileToInstructor,
        logout,
        beginPasswordRecovery,
        completePasswordRecovery,
        hasPerm,
      }}
    >
      {children}
    </AuthContextReact.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContextReact);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

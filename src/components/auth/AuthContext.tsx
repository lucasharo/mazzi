// ============================================================================
// MAZZI PLATFORM — SPRINT 11.5: REAL SUPABASE AUTHENTICATION INTEGRATION
// File: src/components/auth/AuthContext.tsx
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserRole } from '../../types';
import { AppPermission, resolveUserPermissions } from '../../domain/rbac';
import { AuthSessionState } from '../../lib/auth-service';
import { onboardInstructor as onboardInstructorService, getStudentToProMigrationStatus as getStudentToProMigrationStatusService, migrateStudentProfileToInstructor as migrateStudentProfileToInstructorService, signInWithEmail, signUpPublicAccount as signUpPublicAccountService, type SignUpParams, type StudentToProMigrationStatus } from '../../lib/auth-service';
import { supabase } from '../../lib/supabase';

interface AuthContextType extends AuthSessionState {
  signIn: (email: string, password: string) => Promise<void>;
  signUpPublicAccount: (params: SignUpParams) => ReturnType<typeof signUpPublicAccountService>;
  signUpStudent: (params: SignUpParams) => ReturnType<typeof signUpPublicAccountService>;
  beginInstructorOnboarding: () => void;
  cancelInstructorOnboarding: () => void;
  onboardInstructor: () => Promise<Awaited<ReturnType<typeof onboardInstructorService>>>;
  getStudentToProMigrationStatus: () => Promise<StudentToProMigrationStatus>;
  migrateStudentProfileToInstructor: () => Promise<Awaited<ReturnType<typeof migrateStudentProfileToInstructorService>>>;
  logout: () => Promise<void>;
  beginPasswordRecovery: () => void;
  completePasswordRecovery: () => Promise<void>;
  hasPerm: (permission: AppPermission) => boolean;
}

const AuthContextReact = createContext<AuthContextType | undefined>(undefined);

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
  const instructorOnboardingRef = useRef(false);

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

  const handleSession = async (session: any) => {
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
        const { data: prov } = await sp
          .from('providers')
          .select('id,status')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (prov) {
          providerId = prov.id;
          providerStatus = prov.status;
        }

        const { data: staff } = await sp
          .from('driving_school_staff')
          .select('school_id')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (staff) schoolId = staff.school_id;
      }

      const mappedUser = {
        id: user.id,
        email,
        name: profile?.name || user.user_metadata?.name || 'Usuário',
        phone: profile?.phone || user.user_metadata?.phone || '',
        cpf: profile?.cpf || user.user_metadata?.cpf,
        birthDate: profile?.birth_date || user.user_metadata?.birth_date,
        roles,
        status: (profile?.status || 'ACTIVE') as any,
        providerId,
        providerStatus,
        schoolId,
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
      const { user } = await signInWithEmail({ email, password });
      if (!user) throw new Error('A autenticação não retornou um usuário válido.');
      await handleSession({ user });
    } catch (err: any) {
      setAuthState(prev => ({ ...prev, isLoading: false, error: err?.message || 'Falha ao autenticar.' }));
      throw err;
    }
  };

  const beginInstructorOnboarding = () => {
    instructorOnboardingRef.current = true;
    setAuthState((prev) => ({ ...prev, isInstructorOnboarding: true, error: null }));
  };

  const cancelInstructorOnboarding = () => {
    instructorOnboardingRef.current = false;
    setAuthState((prev) => ({ ...prev, isInstructorOnboarding: false }));
  };

  const signUpPublicAccount = (params: SignUpParams) => signUpPublicAccountService(params);
  const signUpStudent = (params: SignUpParams) => signUpPublicAccountService(params);
  const onboardInstructor = async () => {
    try {
      const result = await onboardInstructorService();
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        throw new Error('AUTH_SESSION_UNAVAILABLE: Não foi possível reidratar a sessão do instrutor.');
      }
      instructorOnboardingRef.current = false;
      await handleSession(session);
      return result;
    } catch (error) {
      setAuthState((prev) => ({ ...prev, isInstructorOnboarding: true, isLoading: false }));
      throw error;
    }
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

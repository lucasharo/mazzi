// ============================================================================
// MAZZI PLATFORM — SPRINT 11.5: REAL SUPABASE AUTHENTICATION INTEGRATION
// File: src/components/auth/AuthContext.tsx
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../../types';
import { AppPermission, resolveUserPermissions } from '../../domain/rbac';
import { AuthSessionState } from '../../lib/auth-service';
import { signInWithEmail, signUpStudent as signUpStudentService, type SignUpParams } from '../../lib/auth-service';
import { supabase } from '../../lib/supabase';

interface AuthContextType extends AuthSessionState {
  signIn: (email: string, password: string) => Promise<void>;
  signUpStudent: (params: SignUpParams) => ReturnType<typeof signUpStudentService>;
  logout: () => Promise<void>;
  hasPerm: (permission: AppPermission) => boolean;
}

const AuthContextReact = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthSessionState>({
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const handleSession = async (session: any) => {
    if (!session?.user) {
      setAuthState({
        user: null,
        permissions: [],
        isAuthenticated: false,
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
            isLoading: false,
            error: 'Perfil não provisionado para este usuário. Contate o suporte.',
          });
          return;
        }

        // Only bootstrap for brand new STUDENTS
        const name = user.user_metadata?.name || 'Novo Aluno';
        const phone = user.user_metadata?.phone || '';

        if ((import.meta as any).env?.DEV) {
          console.debug('[MAZZI_PROFILE_DEBUG]', {
            profileFound: false,
            profileInsertAttempted: true,
          });
        }

        const { data: insertedProfile, error: insertErr } = await sp
          .from('users')
          .insert({
            id: user.id,
            email,
            name,
            phone,
            role: 'STUDENT',
            status: 'ACTIVE',
          })
          .select()
          .single();

        if (insertErr) {
          console.error('Error auto-creating user profile:', insertErr);
          throw insertErr;
        } else {
          profile = insertedProfile;
        }
      }

      const userRole: UserRole = (profile?.role || user.user_metadata?.role || 'STUDENT') as UserRole;

      // 2. Fetch active provider details or school details if any (only for instructors or school admins)
      let providerId: string | undefined;
      let schoolId: string | undefined;

      if (profile && (userRole === 'INSTRUCTOR' || userRole === 'SCHOOL_ADMIN')) {
        const { data: prov } = await sp
          .from('providers')
          .select('id')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (prov) providerId = prov.id;

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
        roles: [userRole],
        status: (profile?.status || 'ACTIVE') as any,
        providerId,
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
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.error('Failed to handle session hydration:', err);
      setAuthState({
        user: null,
        permissions: [],
        isAuthenticated: false,
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

  const signUpStudent = (params: SignUpParams) => signUpStudentService(params);

  const logout = async () => {
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
        signUpStudent,
        logout,
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

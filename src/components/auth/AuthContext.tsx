// ============================================================================
// MAZZI PLATFORM — SPRINT 11.5: REAL SUPABASE AUTHENTICATION INTEGRATION
// File: src/components/auth/AuthContext.tsx
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../../types';
import { AppPermission, resolveUserPermissions } from '../../domain/rbac';
import { AuthSessionState } from '../../lib/auth-service';
import { supabase } from '../../lib/supabase';

interface AuthContextType extends AuthSessionState {
  loginAsDemoUser: (role: UserRole, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPerm: (permission: AppPermission) => boolean;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContextReact = createContext<AuthContextType | undefined>(undefined);

export const DEMO_ACCOUNTS: Record<UserRole, { id: string; name: string; email: string; providerId?: string; schoolId?: string }> = {
  STUDENT: {
    id: 'b07013c1-ce07-47d1-b4fd-8c8f4cdaedff',
    name: 'Ana Souza (Aluna Demo)',
    email: 'aluno01@mazzi.com.br',
  },
  INSTRUCTOR: {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Carlos Instrutor (Pinheiros)',
    email: 'instrutor01@mazzi.com.br',
    providerId: '22222222-2222-2222-2222-222222222201',
  },
  SCHOOL_ADMIN: {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Roberto Gestor (CFC Paulista)',
    email: 'autoescola01@mazzi.com.br',
    schoolId: '22222222-2222-2222-2222-222222222202',
  },
  SCHOOL_STAFF: {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'Mariana Atendente (CFC Paulista)',
    email: 'mariana.staff@cfcpaulista.com.br',
    schoolId: '22222222-2222-2222-2222-222222222202',
  },
  PLATFORM_ADMIN: {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Admin Mazzi Oficial',
    email: 'admin@mazzi.com.br',
  },
  SUPPORT: {
    id: '11111111-1111-1111-1111-111111111106',
    name: 'Suporte Mazzi Atendimento',
    email: 'suporte@mazzi.com.br',
  },
};

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
      
      console.log('AUTH_SESSION_USER_ID =', session?.user?.id);
      console.log('AUTH_VALIDATED_USER_ID =', authUser?.id);

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

      console.log('PROFILE_QUERY_USER_ID =', profileQueryUserId);

      // 1. Fetch profile from public.users table
      let { data: profile, error: profileErr } = await sp
        .from('users')
        .select('*')
        .eq('id', profileQueryUserId)
        .maybeSingle();

      const profileFound = !!profile;
      console.log('PROFILE_FOUND =', profileFound ? 'YES' : 'NO');
      console.log('PROFILE_INSERT_ATTEMPTED =', 'NO');

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

        console.log('PROFILE_INSERT_ATTEMPTED =', 'YES');

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

  const loginAsDemoUser = async (role: UserRole, email?: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    const demo = DEMO_ACCOUNTS[role];
    const emailToUse = email || demo.email;

    try {
      // 1. Sign in with correct pre-provisioned password (Mazzi@2026!) without signup fallback
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: 'Mazzi@2026!',
      });

      if (error) {
        throw error;
      }

      await handleSession({ user: data.user });
    } catch (err: any) {
      console.error('Demo login error:', err);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Falha ao autenticar no Supabase',
      }));
    }
  };

  const switchRole = async (newRole: UserRole) => {
    await loginAsDemoUser(newRole);
  };

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
        loginAsDemoUser,
        logout,
        hasPerm,
        switchRole,
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

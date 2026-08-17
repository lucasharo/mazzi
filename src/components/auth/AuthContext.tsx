// ============================================================================
// MAZZI PLATFORM — SPRINT 11.5: REAL SUPABASE AUTHENTICATION INTEGRATION
// File: src/components/auth/AuthContext.tsx
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../../types';
import { AppPermission, resolveUserPermissions } from '../../domain/rbac';
import { AuthSessionState } from '../../lib/auth-service';
import { signInWithEmail } from '../../lib/auth-service';
import { supabase } from '../../lib/supabase';

export type DemoLoginUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  label: string;
  providerId?: string;
  schoolId?: string;
};

interface AuthContextType extends AuthSessionState {
  signIn: (email: string, password: string) => Promise<void>;
  loginAsDemoUser: (role: UserRole, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPerm: (permission: AppPermission) => boolean;
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContextReact = createContext<AuthContextType | undefined>(undefined);

export const DEMO_LOGIN_USERS: DemoLoginUser[] = [
  {
    id: 'b07013c1-ce07-47d1-b4fd-8c8f4cdaedff',
    name: 'Ana Beatriz Souza',
    email: 'aluno01@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '93f9df4c-55a6-436d-97b3-beac28d69da7',
    name: 'Bruno Henrique Lima',
    email: 'aluno02@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '861a7698-fceb-4a5e-947c-354613c30e01',
    name: 'Camila Ferreira Alves',
    email: 'aluno03@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: 'f434b0a8-2e10-4153-b222-3db0a8466641',
    name: 'Daniel Martins Costa',
    email: 'aluno04@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '59d786e5-bad5-4dc6-bc14-98712e3d8d16',
    name: 'Eduarda Ribeiro Santos',
    email: 'aluno05@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '5595c1e0-cc2e-4d1c-a791-54a5a45f8ddb',
    name: 'Felipe Gomes Rocha',
    email: 'aluno06@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: 'fc12a682-93ff-42c7-b3dd-805333eb279a',
    name: 'Gabriela Nunes Silva',
    email: 'aluno07@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '26300e5c-792c-4ca0-b242-17ea6756c341',
    name: 'Henrique Almeida Prado',
    email: 'aluno08@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '905f654c-98ce-4a71-a05d-ed5e408e0831',
    name: 'Isabela Carvalho Mendes',
    email: 'aluno09@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: '911cf87a-813d-44b7-a6c5-b7bd85ef1ff6',
    name: 'Joao Pedro Oliveira',
    email: 'aluno10@mazzi.com.br',
    role: 'STUDENT',
    label: 'Aluno',
  },
  {
    id: 'ce5cc243-f3c9-4391-8ff4-298412a3f98d',
    name: 'Carlos Eduardo Souza',
    email: 'instrutor01@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: '230cc4a0-4a82-41ff-bda9-5f8f216e5980',
    name: 'Fernanda Rocha Lima',
    email: 'instrutor02@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: '6256ab41-be70-47a3-919a-f3f2b2758c41',
    name: 'Marcos Vinicius Prado',
    email: 'instrutor03@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: '3d36f448-71e9-42e7-99fc-208264280629',
    name: 'Renata Carvalho Silva',
    email: 'instrutor04@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: '0c897aad-268a-4bf5-ae00-d8ca4a8e1dc7',
    name: 'Andre Barbosa Nunes',
    email: 'instrutor05@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: 'd80288c5-e9d5-41c6-b70d-e11c0730e879',
    name: 'Patricia Gomes Reis',
    email: 'instrutor06@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: '0b23e9e5-8427-40cb-b6d7-e8ee69134bca',
    name: 'Diego Moreira Alves',
    email: 'instrutor07@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: 'd10e5f00-6ae1-40ac-8a47-922410e28e53',
    name: 'Aline Teixeira Costa',
    email: 'instrutor08@mazzi.com.br',
    role: 'INSTRUCTOR',
    label: 'Instrutor autonomo',
  },
  {
    id: '34437b7c-7e90-4c96-b4ee-88fbd0e9c1c4',
    name: 'Autoescola Paulista',
    email: 'autoescola01@mazzi.com.br',
    role: 'SCHOOL_ADMIN',
    label: 'Gestor de autoescola',
  },
  {
    id: 'ad2678e0-d992-4a16-947d-94de00fe49d0',
    name: 'Autoescola Vila Mariana',
    email: 'autoescola02@mazzi.com.br',
    role: 'SCHOOL_ADMIN',
    label: 'Gestor de autoescola',
  },
  {
    id: '65302b7a-dc3c-42be-be44-cfff864c1252',
    name: 'Administrador MAZZI',
    email: 'admin@mazzi.com.br',
    role: 'PLATFORM_ADMIN',
    label: 'Admin da plataforma',
  },
];

export const DEMO_ACCOUNTS: Record<UserRole, { id: string; name: string; email: string; providerId?: string; schoolId?: string }> = {
  STUDENT: {
    id: DEMO_LOGIN_USERS[0].id,
    name: DEMO_LOGIN_USERS[0].name,
    email: DEMO_LOGIN_USERS[0].email,
  },
  INSTRUCTOR: {
    id: DEMO_LOGIN_USERS[10].id,
    name: DEMO_LOGIN_USERS[10].name,
    email: DEMO_LOGIN_USERS[10].email,
    providerId: DEMO_LOGIN_USERS[10].providerId,
  },
  SCHOOL_ADMIN: {
    id: DEMO_LOGIN_USERS[18].id,
    name: DEMO_LOGIN_USERS[18].name,
    email: DEMO_LOGIN_USERS[18].email,
    schoolId: DEMO_LOGIN_USERS[18].schoolId,
  },
  SCHOOL_STAFF: {
    id: DEMO_LOGIN_USERS[18].id,
    name: DEMO_LOGIN_USERS[18].name,
    email: DEMO_LOGIN_USERS[18].email,
  },
  PLATFORM_ADMIN: {
    id: DEMO_LOGIN_USERS[20].id,
    name: DEMO_LOGIN_USERS[20].name,
    email: DEMO_LOGIN_USERS[20].email,
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
      throw err;
    }
  };

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
      signIn,
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

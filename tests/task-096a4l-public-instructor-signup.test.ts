import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const appLogin = fs.readFileSync(path.join(root, 'src/components/auth/AppLogin.tsx'), 'utf8');
const authContext = fs.readFileSync(path.join(root, 'src/components/auth/AuthContext.tsx'), 'utf8');
const authService = fs.readFileSync(path.join(root, 'src/lib/auth-service.ts'), 'utf8');
const instructorRoot = fs.readFileSync(path.join(root, 'src/entrypoints/instructor/InstructorRoot.tsx'), 'utf8');
const providerApp = fs.readFileSync(path.join(root, 'src/apps/provider/ProviderApp.tsx'), 'utf8');

describe('TASK-096A4L secure public instructor signup', () => {
  it('exposes a professional CTA only in the PRO login and preserves student signup', () => {
    expect(appLogin).toContain("kind !== 'admin'");
    expect(appLogin).toContain('Quero ser instrutor');
    expect(appLogin).toContain("kind === 'student'");
    expect(appLogin).toContain("'Entrar no MAZZI'");
    expect(appLogin).not.toContain("kind === 'admin' &&");
  });

  it('uses professional signup copy and the shared public bootstrap', () => {
    expect(appLogin).toContain('Criar conta profissional');
    expect(appLogin).toContain('credenciamento como instrutor');
    expect(appLogin).not.toContain('kind === \'instructor\'\n            ? \'Preencha seus dados para começar suas aulas');
    expect(appLogin).toContain('signUpPublicAccount');
    expect(authService).toContain('export async function signUpPublicAccount');
    expect(authService).toContain("role: 'STUDENT'");
    expect(authService).not.toContain("role: 'INSTRUCTOR'");
  });

  it('keeps onboarding behind the authenticated RPC and protects the transition state', () => {
    expect(authContext).toContain("onboardInstructorService()");
    expect(authContext).toContain("isInstructorOnboarding");
    expect(authContext).toContain('beginInstructorOnboarding');
    expect(authContext).toContain('cancelInstructorOnboarding');
    expect(authContext).toContain('await handleSession(session)');
    expect(authContext).not.toContain("rpc('onboard_my_instructor', {");
    expect(instructorRoot).toContain('auth.isInstructorOnboarding');
    expect(instructorRoot).toContain("auth.user?.roles.includes('STUDENT')");
  });

  it('uses an explicit professional role in PRO instead of roles[0]', () => {
    expect(providerApp).toContain("['INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF'].includes(role)");
    expect(providerApp).not.toContain('setCurrentRole(user.roles[0])');
  });

  it('keeps retry, DRAFT onboarding and public-search safety as explicit contracts', () => {
    expect(appLogin).toContain('Continuar cadastro profissional');
    expect(instructorRoot).toContain('<ProviderApp />');
    expect(authService).toContain('onboard_my_instructor');
  });
});

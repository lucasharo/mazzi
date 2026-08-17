import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
const login = fs.readFileSync('src/components/auth/AppLogin.tsx', 'utf8');
const context = fs.readFileSync('src/components/auth/AuthContext.tsx', 'utf8');
const service = fs.readFileSync('src/lib/auth-service.ts', 'utf8');
const demos = fs.readFileSync('src/components/auth/dev/demo-accounts.ts', 'utf8');
const quickLogin = fs.readFileSync('src/components/auth/dev/DevQuickLogin.tsx', 'utf8');

describe('Premium auth UX', () => {
  it('keeps app-filtered quick login dev-only and backed by real signIn', () => {
    expect(login).toContain('import.meta.env.DEV');
    expect(quickLogin).toContain('await signIn(account.email, DEV_QUICK_LOGIN_PASSWORD)');
    expect(quickLogin).not.toContain('switchRole');
    expect(context).not.toContain('loginAsDemoUser');
    expect(demos).toContain("'aluno'"); expect(demos).toContain("'instrutor'"); expect(demos).toContain("'autoescola'");
  });
  it('restores real student signup and confirmation without fake success', () => {
    expect(login).toContain('Criar conta'); expect(login).toContain("goTo('email_confirmation')");
    expect(login).toContain('signUpStudent({'); expect(login).toContain('confirmPassword');
    expect(login).not.toContain('setTimeout'); expect(service).toContain("role: 'STUDENT'"); expect(login).not.toMatch(/<select/i);
  });
  it('does not publicly escalate instructor, school, or admin roles', () => {
    expect(login).toContain('Nenhuma conta foi criada.'); expect(login).not.toContain("role: 'INSTRUCTOR'");
    expect(login).not.toContain('Cadastro aprovado'); expect(login).not.toContain('Cadastre-se como autoescola');
  });
});

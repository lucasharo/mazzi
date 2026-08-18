import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const login = fs.readFileSync('src/components/auth/AppLogin.tsx', 'utf8');
const context = fs.readFileSync('src/components/auth/AuthContext.tsx', 'utf8');
const service = fs.readFileSync('src/lib/auth-service.ts', 'utf8');
const demos = fs.readFileSync('src/components/auth/dev/demo-accounts.ts', 'utf8');
const quickLogin = fs.readFileSync('src/components/auth/dev/DevQuickLogin.tsx', 'utf8');
const inputComponent = fs.readFileSync('src/components/ui/Input.tsx', 'utf8');
const otpComponent = fs.readFileSync('src/components/ui/OtpInput.tsx', 'utf8');
const accessDenied = fs.readFileSync('src/components/auth/AccessDenied.tsx', 'utf8');

describe('Premium auth UX & Harmonization', () => {
  it('keeps app-filtered quick login dev-only and backed by real signIn', () => {
    expect(login).toContain('import.meta.env.DEV');
    expect(quickLogin).toContain('await signIn(account.email, DEV_QUICK_LOGIN_PASSWORD)');
    expect(quickLogin).not.toContain('switchRole');
    expect(context).not.toContain('loginAsDemoUser');
    expect(demos).toContain("'aluno'");
    expect(demos).toContain("'instrutor'");
    expect(demos).toContain("'autoescola'");
  });

  it('restores real student signup with OTP confirmation, CPF and Birth Date', () => {
    expect(login).toContain('Criar conta');
    expect(login).toContain("goTo('signup_otp')");
    expect(login).toContain('signUpStudent({');
    expect(login).toContain('confirmPassword');
    expect(login).toContain('cleanCpf');
    expect(login).toContain('birthDate');
    expect(service).toContain("role: 'STUDENT'");
    expect(login).not.toMatch(/<select/i);
  });

  it('provides native 6-digit OTP verification for signup and recovery', () => {
    expect(service).toContain('verifyEmailOtp');
    expect(service).toContain('verifyRecoveryOtp');
    expect(service).toContain('resendSignupOtp');
    expect(login).toContain('verifyEmailOtp({');
    expect(login).toContain('verifyRecoveryOtp({');
    expect(login).toContain('resendSignupOtp(');
    expect(otpComponent).toContain('autoComplete="one-time-code"');
    expect(otpComponent).toContain('inputMode="numeric"');
    expect(otpComponent).toContain('maxLength={6}');
  });

  it('does not publicly escalate instructor, school, or admin roles', () => {
    expect(login).toContain('Nenhuma conta foi criada.');
    expect(login).not.toContain("role: 'INSTRUCTOR'");
    expect(login).not.toContain('Cadastro aprovado');
    expect(login).not.toContain('Cadastre-se como autoescola');
  });

  it('uses unified design system tokens, buttons and inputs matching Student App', () => {
    expect(login).toContain('PrimaryButton');
    expect(login).toContain('SecondaryButton');
    expect(login).toContain('PasswordInput');
    expect(login).toContain('Input');
    expect(login).toContain('OtpInput');
    expect(login).toContain('border-[var(--mazzi-border)]');
    expect(login).toContain('mazzi-eyebrow');
    expect(login).not.toContain('bg-slate-950 p-3 font-black text-amber-400');
  });

  it('provides integrated password visibility toggle (Eye/EyeOff) in Input primitives', () => {
    expect(inputComponent).toContain('Eye');
    expect(inputComponent).toContain('EyeOff');
    expect(inputComponent).toContain('PasswordInput');
    expect(inputComponent).toContain('aria-label={showPassword ?');
  });

  it('supports autocomplete attributes across all auth forms', () => {
    expect(login).toContain('autoComplete="email"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).toContain('autoComplete="new-password"');
    expect(login).toContain('autoComplete="name"');
    expect(login).toContain('autoComplete="tel"');
  });

  it('harmonizes AccessDenied screen with MAZZI design language and logout CTA', () => {
    expect(accessDenied).toContain('ShieldAlert');
    expect(accessDenied).toContain('SecondaryButton');
    expect(accessDenied).toContain('mazzi-eyebrow');
    expect(accessDenied).toContain('border-[var(--mazzi-border)]');
  });

  it('supports reset password screen with updatePassword integration', () => {
    expect(login).toContain('reset_password');
    expect(login).toContain('updatePassword(');
    expect(login).toContain('Salvar nova senha');
  });

  it('translates raw Supabase errors to friendly user-facing Portuguese', () => {
    expect(login).toContain('E-mail ou senha incorretos. Confira seus dados e tente novamente.');
    expect(login).toContain('formatAuthError(contextError)');
  });

  it('checks email existence on forgot password and offers direct signup CTA if not registered', () => {
    expect(login).toContain('checkUserEmailExists');
    expect(service).toContain('checkUserEmailExists');
    expect(login).toContain('Este e-mail não está cadastrado no MAZZI. Verifique o endereço digitado ou crie sua conta.');
    expect(login).toContain('Criar minha conta no MAZZI');
  });
});



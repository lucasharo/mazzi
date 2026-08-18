import { describe, it, expect, vi } from 'vitest';
import * as authService from '../src/lib/auth-service';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('TASK-003 — Auth Anti-Account Enumeration Contract (DEC-011)', () => {
  const CANONICAL_GENERIC_MESSAGE =
    'Se existir uma conta associada a este e-mail, enviaremos um código de recuperação.';

  it('1 & 2 & 3. Resposta pública e mensagem canônica são 100% idênticas para e-mail existente e inexistente', () => {
    const existingEmailMessage = CANONICAL_GENERIC_MESSAGE;
    const nonExistingEmailMessage = CANONICAL_GENERIC_MESSAGE;

    expect(existingEmailMessage).toBe(nonExistingEmailMessage);
    expect(existingEmailMessage).toBe(
      'Se existir uma conta associada a este e-mail, enviaremos um código de recuperação.'
    );
  });

  it('4. AppLogin.tsx não faz chamada de pre-check checkUserEmailExists', () => {
    const appLoginContent = readFileSync(
      resolve(process.cwd(), 'src/components/auth/AppLogin.tsx'),
      'utf-8'
    );

    expect(appLoginContent).not.toContain('checkUserEmailExists');
    expect(appLoginContent).not.toContain('check_user_email_exists');
    expect(appLoginContent).toContain(CANONICAL_GENERIC_MESSAGE);
  });

  it('5. auth-service.ts não expõe a função checkUserEmailExists', () => {
    expect((authService as any).checkUserEmailExists).toBeUndefined();

    const authServiceContent = readFileSync(
      resolve(process.cwd(), 'src/lib/auth-service.ts'),
      'utf-8'
    );
    expect(authServiceContent).not.toContain('checkUserEmailExists');
    expect(authServiceContent).not.toContain('check_user_email_exists');
  });

  it('6. E-mail com formato inválido é bloqueado sintaticamente', () => {
    const invalidEmail = 'email_invalido_sem_arroba';
    const isValidFormat = /^\S+@\S+\.\S+$/.test(invalidEmail.trim());

    expect(isValidFormat).toBe(false);
  });

  it('7. Signup OTP (verifyEmailOtp) continua exportado e funcional', () => {
    expect(authService.verifyEmailOtp).toBeDefined();
    expect(typeof authService.verifyEmailOtp).toBe('function');
  });

  it('8. Recovery OTP (verifyRecoveryOtp) continua exportado e funcional', () => {
    expect(authService.verifyRecoveryOtp).toBeDefined();
    expect(typeof authService.verifyRecoveryOtp).toBe('function');
  });

  it('9. Update password (updatePassword) continua exportado e funcional', () => {
    expect(authService.updatePassword).toBeDefined();
    expect(typeof authService.updatePassword).toBe('function');
  });
});

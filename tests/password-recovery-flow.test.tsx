// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { auth, verifyRecoveryOtp, updatePassword, requestPasswordReset } = vi.hoisted(() => ({
  auth: {
    signIn: vi.fn(),
    signUpStudent: vi.fn(),
    beginPasswordRecovery: vi.fn(),
    completePasswordRecovery: vi.fn().mockResolvedValue(undefined),
    error: null,
    isLoading: false,
  },
  verifyRecoveryOtp: vi.fn(),
  updatePassword: vi.fn(),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/components/auth/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../src/lib/auth-service', () => ({
  requestPasswordReset,
  resendSignupOtp: vi.fn(),
  updatePassword,
  verifyEmailOtp: vi.fn(),
  verifyRecoveryOtp,
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

import { AppLogin, formatAuthError } from '../src/components/auth/AppLogin';
import { AUTH_OTP_RESEND_COOLDOWN_SECONDS } from '../src/lib/auth-constants';

describe('TASK-064 — password recovery isolation', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    verifyRecoveryOtp.mockReset();
    updatePassword.mockReset();
    requestPasswordReset.mockResolvedValue(undefined);
    auth.completePasswordRecovery.mockResolvedValue(undefined);
    auth.error = null;
  });

  async function openRecoveryOtp() {
    render(<AppLogin kind="student" />);
    fireEvent.click(screen.getByRole('button', { name: 'Esqueceu sua senha?' }));
    fireEvent.change(screen.getByLabelText('E-mail cadastrado'), {
      target: { value: 'student@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
    await screen.findByRole('heading', { name: 'Digite o código' });
    fireEvent.change(screen.getByLabelText('Código de recuperação'), {
      target: { value: '123456' },
    });
  }

  it('keeps recovery OTP sessions out of the StudentApp flow', async () => {
    verifyRecoveryOtp.mockResolvedValue({ session: { user: { id: 'recovery-user' } } });

    await openRecoveryOtp();
    fireEvent.click(screen.getByRole('button', { name: 'Validar código' }));

    await screen.findByRole('heading', { name: 'Criar nova senha' });
    expect(auth.beginPasswordRecovery.mock.invocationCallOrder[0]).toBeLessThan(
      verifyRecoveryOtp.mock.invocationCallOrder[0],
    );
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('updates the password, signs out recovery, and does not auto-login', async () => {
    verifyRecoveryOtp.mockResolvedValue({ session: { user: { id: 'recovery-user' } } });
    updatePassword.mockResolvedValue({ user: { id: 'recovery-user' } });

    await openRecoveryOtp();
    fireEvent.click(screen.getByRole('button', { name: 'Validar código' }));
    await screen.findByRole('heading', { name: 'Criar nova senha' });

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'new-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('new-password-123'));
    expect(auth.completePasswordRecovery).toHaveBeenCalledTimes(1);
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('returns to the OTP screen after an invalid recovery code', async () => {
    verifyRecoveryOtp.mockRejectedValue(new Error('invalid otp'));

    await openRecoveryOtp();
    fireEvent.click(screen.getByRole('button', { name: 'Validar código' }));

    await screen.findByRole('heading', { name: 'Digite o código' });
    expect(auth.completePasswordRecovery).toHaveBeenCalledTimes(1);
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('opens signup OTP when login reports an unconfirmed email', async () => {
    auth.signIn.mockImplementationOnce(async () => {
      auth.error = 'Seu e-mail ainda não foi confirmado.';
      throw new Error('Seu e-mail ainda não foi confirmado.');
    });

    render(<AppLogin kind="student" />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await screen.findByRole('heading', { name: 'Confirme seu e-mail' });
    expect(screen.getByLabelText('Código de confirmação').getAttribute('maxLength')).toBe('6');
    expect(screen.queryByText('Confirme o código de 6 dígitos enviado para o seu e-mail.')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para o login' }));
    expect(screen.getByRole('button', { name: 'Entrar' })).not.toBeNull();
  });

  it('translates Supabase resend limits and uses the 60-second product cooldown', () => {
    expect(formatAuthError('For security purposes, you can only request this after 9 seconds.'))
      .toBe('Para sua segurança, aguarde 9 segundos antes de solicitar um novo código.');
    expect(AUTH_OTP_RESEND_COOLDOWN_SECONDS).toBe(60);
  });
});

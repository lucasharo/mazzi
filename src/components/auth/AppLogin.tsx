import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  requestPasswordReset, resendSignupOtp, updatePassword, verifyEmailOtp, verifyRecoveryOtp, } from '../../lib/auth-service';
import { supabase } from '../../lib/supabase';
import { Input, PasswordInput } from '../ui/Input';
import { PrimaryButton, SecondaryButton, ButtonBase } from '../ui/Button';
import { OtpInput } from '../ui/OtpInput';
import { AUTH_OTP_LENGTH } from '../../lib/auth-constants';
import { formatCpf, isValidCpf, normalizeCpf } from '../../utils/cpf';
import { formatDateMask, toISODateString, validateBirthDate } from '../../utils/age';
import { formatPhone, isValidPhone, normalizePhone } from '../../utils/phone';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Mail,
  KeyRound,
  ShieldAlert,
  Clock,
  Sparkles,
  LogIn,
  Pencil,
  RefreshCw,
  UserPlus,
} from 'lucide-react';

export type AppLoginKind = 'student' | 'instructor' | 'admin';
type Screen =
  | 'login'
  | 'signup'
  | 'forgot'
  | 'signup_otp'
  | 'recovery_otp'
  | 'reset_password'
  | 'email_confirmation'
  | 'expired_link';

type Feedback = { tone: 'error' | 'success'; message: string };

export function formatAuthError(errorMsg: string): string {
  if (!errorMsg) return 'Ocorreu um erro. Tente novamente.';
  const lower = errorMsg.toLowerCase();
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid credentials')
  ) {
    return 'E-mail ou senha incorretos. Confira seus dados e tente novamente.';
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return `Seu e-mail ainda não foi confirmado. Digite o código de ${AUTH_OTP_LENGTH} dígitos enviado.`;
  }
  if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('user already exists')) {
    return 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.';
  }
  if (lower.includes('token has expired') || lower.includes('otp_expired') || lower.includes('token expired')) {
    return 'Este código expirou. Solicite um novo código.';
  }
  if (lower.includes('invalid token') || lower.includes('token is invalid') || lower.includes('invalid otp')) {
    return 'Código inválido. Confira e tente novamente.';
  }
  if (lower.includes('over_email_send_rate_limit') || lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('too many requests')) {
    return 'Você solicitou códigos recentemente. Aguarde alguns instantes para tentar novamente.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak_password')) {
    return 'A senha deve ter pelo menos 8 caracteres.';
  }
  if (lower.includes('idx_users_cpf_unique') || (lower.includes('duplicate key') && lower.includes('cpf'))) {
    return 'Este CPF já está cadastrado em outra conta.';
  }
  if (lower.includes('cpf_invalid')) {
    return 'O CPF informado é inválido.';
  }
  if (lower.includes('minimum_age_violation')) {
    return 'Para utilizar o MAZZI, você precisa ter pelo menos 18 anos.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  return errorMsg;
}

export const AppLogin: React.FC<{ kind: AppLoginKind }> = ({ kind }) => {
  const {
    signIn,
    signUpStudent,
    onboardInstructor,
    beginPasswordRecovery,
    completePasswordRecovery,
    error: contextError,
    isLoading: isContextLoading,
  } = useAuth();
  const [screen, setScreen] = useState<Screen>('login');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Field Errors (Inline highlight)
  const [errors, setErrors] = useState<Record<string, string>>({});

  // OTP State
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [DevQuickLogin, setDevQuickLogin] = useState<React.ComponentType<{
    kind: AppLoginKind;
    onError: (message: string) => void;
  }> | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import('./dev/DevQuickLogin')
      .then((module) => setDevQuickLogin(() => module.DevQuickLogin))
      .catch(() => {});
  }, []);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Listen for Supabase Auth PASSWORD_RECOVERY event and check URL hash for legacy link compatibility
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        beginPasswordRecovery();
        setFeedback(null);
        setErrors({});
        setScreen('reset_password');
      }
    });

    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const params = new URLSearchParams(window.location.search || '');
      if (hash.includes('type=recovery') || params.get('type') === 'recovery') {
        beginPasswordRecovery();
        setScreen('reset_password');
      }
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const goTo = (next: Screen) => {
    setFeedback(null);
    setErrors({});
    setOtp('');
    setScreen(next);
  };

  // 1. SUBMIT LOGIN
  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Campo obrigatório.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = 'Informe um e-mail válido.';
    }

    if (!password) {
      newErrors.password = 'Campo obrigatório.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (caught: any) {
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Falha ao autenticar.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. SUBMIT SIGNUP (With CPF, Birth Date & Phone Mask)
  const submitSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const newErrors: Record<string, string> = {};

    // Name Validation: Must have at least 2 names (first name and surname)
    if (!name.trim()) {
      newErrors.name = 'Campo obrigatório.';
    } else {
      const nameParts = name.trim().split(/\s+/).filter((part) => part.length >= 2);
      if (nameParts.length < 2) {
        newErrors.name = 'Informe seu nome completo (nome e sobrenome).';
      }
    }

    // Email Validation
    if (!email.trim()) {
      newErrors.email = 'Campo obrigatório.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = 'Informe um e-mail válido.';
    }

    // Phone Validation with normalization
    const cleanPhone = normalizePhone(phone);
    if (!phone.trim()) {
      newErrors.phone = 'Campo obrigatório.';
    } else if (!isValidPhone(cleanPhone)) {
      newErrors.phone = 'Informe um celular válido com DDD.';
    }

    // CPF Validation
    const cleanCpf = normalizeCpf(cpf);
    if (!cpf.trim()) {
      newErrors.cpf = 'Campo obrigatório.';
    } else if (!isValidCpf(cleanCpf)) {
      newErrors.cpf = 'CPF inválido. Verifique os números digitados.';
    }

    // Birth Date and 18-Year Minimum Age Validation (Text masked DD/MM/AAAA)
    const isoBirthDate = toISODateString(birthDate);
    if (!birthDate.trim()) {
      newErrors.birthDate = 'Campo obrigatório.';
    } else {
      const ageValidation = validateBirthDate(birthDate);
      if (!ageValidation.valid || !isoBirthDate) {
        newErrors.birthDate = ageValidation.error || 'Informe uma data válida (DD/MM/AAAA).';
      }
    }

    // Password Validation
    if (!password) {
      newErrors.password = 'Campo obrigatório.';
    } else if (password.length < 8) {
      newErrors.password = 'A senha deve ter pelo menos 8 caracteres.';
    }

    // Confirm Password Validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Campo obrigatório.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas digitadas precisam ser iguais.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      const { session } = await signUpStudent({
        email: email.trim(),
        password,
        name: name.trim(),
        phone: cleanPhone,
        cpf: cleanCpf,
        birthDate: isoBirthDate!,
      });

      setOtpEmail(email.trim());
      setResendCooldown(45);

      if (!session) {
        // Requires 6-digit OTP verification
        goTo('signup_otp');
      } else {
        if (kind === 'instructor') {
          await onboardInstructor();
        }
        setFeedback({ tone: 'success', message: 'Conta criada com sucesso.' });
      }
    } catch (caught: any) {
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Não foi possível criar sua conta.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. SUBMIT SIGNUP OTP VERIFICATION
  const submitSignupOtp = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setFeedback(null);

    if (!otp.trim()) {
      setErrors({ otp: 'Campo obrigatório.' });
      return;
    }
    if (otp.length !== AUTH_OTP_LENGTH) {
      setErrors({ otp: `Digite o código de ${AUTH_OTP_LENGTH} dígitos enviado por e-mail.` });
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await verifyEmailOtp({ email: otpEmail, token: otp.trim() });
      setFeedback({ tone: 'success', message: 'E-mail confirmado com sucesso!' });
      if (password) {
        await signIn(otpEmail, password);
        if (kind === 'instructor') {
          await onboardInstructor();
        }
      } else {
        goTo('login');
      }
    } catch (caught: any) {
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Falha ao confirmar código.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. RESEND SIGNUP OTP
  const handleResendSignupOtp = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setFeedback(null);
    setErrors({});
    setIsSubmitting(true);
    try {
      await resendSignupOtp(otpEmail);
      setResendCooldown(45);
      setFeedback({ tone: 'success', message: 'Novo código de confirmação enviado para seu e-mail.' });
    } catch (caught: any) {
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Não foi possível reenviar o código.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. SUBMIT FORGOT PASSWORD (Sends 6-digit recovery OTP)
  const submitForgot = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Campo obrigatório.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = 'Informe um e-mail válido para recuperação.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      // Direct password reset request (anti-account enumeration contract)
      try {
        await requestPasswordReset(email.trim());
      } catch (err) {
        // Log technical errors silently; do NOT leak account status to user
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[MAZZI Auth] Password reset request error:', err);
        }
      }

      setOtpEmail(email.trim());
      setResendCooldown(45);
      goTo('recovery_otp');
      setFeedback({
        tone: 'success',
        message: 'Se existir uma conta associada a este e-mail, enviaremos um código de recuperação.',
      });
    } catch (caught: any) {
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Não foi possível enviar o código.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. SUBMIT RECOVERY OTP
  const submitRecoveryOtp = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setFeedback(null);

    if (!otp.trim()) {
      setErrors({ otp: 'Campo obrigatório.' });
      return;
    }
    if (otp.length !== AUTH_OTP_LENGTH) {
      setErrors({ otp: `Digite o código de ${AUTH_OTP_LENGTH} dígitos recebido por e-mail.` });
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      // Mark recovery before verifyOtp emits the temporary authenticated session.
      beginPasswordRecovery();
      await verifyRecoveryOtp({ email: otpEmail, token: otp.trim() });
      goTo('reset_password');
    } catch (caught: any) {
      await completePasswordRecovery();
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Código de recuperação inválido.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. SUBMIT RESET PASSWORD
  const submitResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = 'Campo obrigatório.';
    } else if (password.length < 8) {
      newErrors.password = 'A nova senha deve ter pelo menos 8 caracteres.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Campo obrigatório.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'As senhas digitadas precisam ser iguais.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      await updatePassword(password);
      await completePasswordRecovery();
      setPassword('');
      setConfirmPassword('');
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setFeedback({
        tone: 'success',
        message: 'Sua senha foi alterada com sucesso! Redirecionando para o login...',
      });
      setTimeout(() => {
        goTo('login');
      }, 2000);
    } catch (caught: any) {
      setFeedback({
        tone: 'error',
        message: formatAuthError(caught instanceof Error ? caught.message : 'Não foi possível salvar a nova senha.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || isContextLoading;
  const activeError =
    feedback?.tone === 'error'
      ? formatAuthError(feedback.message)
      : contextError
      ? formatAuthError(contextError)
      : null;

  const shell = (content: React.ReactNode) => (
    <main className="min-h-[100dvh] w-full bg-[var(--mazzi-bg)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="mazzi-card w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-[var(--mazzi-border)] shadow-sm text-left">
        {content}
      </div>
    </main>
  );

  const brandTag = kind === 'instructor' ? 'MAZZI PRO' : kind === 'admin' ? 'MAZZI ADMIN' : 'MAZZI';

  // ==========================================
  // SCREEN: SIGNUP OTP VERIFICATION
  // ==========================================
  if (screen === 'signup_otp') {
    return shell(
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] border border-amber-200/60 text-[var(--mazzi-dark)] shadow-xs">
          <Mail className="h-7 w-7 text-amber-600" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="mazzi-eyebrow">{brandTag}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight">
            Confirme seu e-mail
          </h1>
          <p className="text-sm text-slate-600">
            Enviamos um código de {AUTH_OTP_LENGTH} dígitos para{' '}
            <strong className="text-slate-900 font-semibold">{otpEmail}</strong>.
          </p>
        </div>

        {feedback && (
          <div
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-left text-xs font-semibold ${
              feedback.tone === 'error'
                ? 'bg-rose-50 border border-rose-200/60 text-rose-700'
                : 'bg-emerald-50 border border-emerald-200/60 text-emerald-800'
            }`}
          >
            {feedback.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form noValidate onSubmit={submitSignupOtp} className="space-y-5">
          <OtpInput
            value={otp}
            onChange={(val) => {
              setOtp(val);
              clearError('otp');
            }}
            onEnter={() => submitSignupOtp()}
            disabled={isLoading}
            error={errors.otp}
            label="Código de confirmação"
            hint={`Digite os ${AUTH_OTP_LENGTH} dígitos recebidos no seu e-mail.`}
          />

          <PrimaryButton
            type="submit"
            size="sm"
            className="w-full font-bold shadow-xs cursor-pointer"
            disabled={isLoading || otp.length !== AUTH_OTP_LENGTH}
            loading={isLoading}
          >
            {isLoading ? 'Confirmando…' : 'Confirmar e-mail'}
          </PrimaryButton>

          <div className="pt-2 flex flex-col gap-3 items-center">
            <ButtonBase
              type="button"
              onClick={handleResendSignupOtp}
              disabled={resendCooldown > 0 || isLoading}
              className="inline-flex items-center gap-1.5 py-1 text-xs font-bold text-amber-700 transition hover:text-amber-800 disabled:cursor-not-allowed disabled:text-slate-400 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {resendCooldown > 0 ? `Reenviar código em ${resendCooldown}s` : 'Reenviar código por e-mail'}
            </ButtonBase>

            <ButtonBase
              type="button"
              onClick={() => goTo('signup')}
              className="inline-flex cursor-pointer items-center gap-1.5 py-1 text-xs font-semibold text-slate-500 transition hover:text-slate-800"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Alterar e-mail ou dados
            </ButtonBase>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================
  // SCREEN: RECOVERY OTP VERIFICATION
  // ==========================================
  if (screen === 'recovery_otp') {
    return shell(
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] border border-amber-200/60 text-[var(--mazzi-dark)] shadow-xs">
          <KeyRound className="h-7 w-7 text-amber-600" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="mazzi-eyebrow">{brandTag}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight">
            Digite o código
          </h1>
          <p className="text-sm text-slate-600">
            Informe o código de {AUTH_OTP_LENGTH} dígitos enviado para{' '}
            <strong className="text-slate-900 font-semibold">{otpEmail}</strong>.
          </p>
        </div>

        {feedback && (
          <div
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-left text-xs font-semibold ${
              feedback.tone === 'error'
                ? 'bg-rose-50 border border-rose-200/60 text-rose-700'
                : 'bg-emerald-50 border border-emerald-200/60 text-emerald-800'
            }`}
          >
            {feedback.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form noValidate onSubmit={submitRecoveryOtp} className="space-y-5">
          <OtpInput
            value={otp}
            onChange={(val) => {
              setOtp(val);
              clearError('otp');
            }}
            onEnter={() => submitRecoveryOtp()}
            disabled={isLoading}
            error={errors.otp}
            label="Código de recuperação"
            hint={`Código de ${AUTH_OTP_LENGTH} dígitos enviado por e-mail.`}
          />

          <PrimaryButton
            type="submit"
            size="sm"
            className="w-full font-bold shadow-xs cursor-pointer"
            disabled={isLoading || otp.length !== AUTH_OTP_LENGTH}
            loading={isLoading}
          >
            {isLoading ? 'Validando…' : 'Validar código'}
          </PrimaryButton>

          <div className="pt-2">
            <SecondaryButton
              type="button"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
              onClick={() => goTo('forgot')}
              className="w-full cursor-pointer"
            >
              Voltar
            </SecondaryButton>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================
  // SCREEN: RESET PASSWORD
  // ==========================================
  if (screen === 'reset_password') {
    return shell(
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] border border-amber-200/60 text-[var(--mazzi-dark)] shadow-xs mb-3">
            <KeyRound className="h-7 w-7 text-amber-600" aria-hidden="true" />
          </div>
          <p className="mazzi-eyebrow">{brandTag}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight">
            Criar nova senha
          </h1>
          <p className="text-sm text-slate-600">
            Digite sua nova senha para acessar sua conta MAZZI.
          </p>
        </div>

        {feedback && (
          <div
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-semibold ${
              feedback.tone === 'error'
                ? 'bg-rose-50 border border-rose-200/60 text-rose-700'
                : 'bg-emerald-50 border border-emerald-200/60 text-emerald-800'
            }`}
          >
            {feedback.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form noValidate onSubmit={submitResetPassword} className="space-y-4">
          <PasswordInput
            id="new-password"
            label="Nova senha"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
            }}
            error={errors.password}
            autoComplete="new-password"
            disabled={isLoading}
            hint="Mínimo de 8 caracteres"
          />

          <PasswordInput
            id="confirm-new-password"
            label="Confirmar nova senha"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearError('confirmPassword');
            }}
            error={errors.confirmPassword}
            autoComplete="new-password"
            disabled={isLoading}
          />

          <PrimaryButton
            type="submit"
            size="sm"
            className="w-full font-bold shadow-xs cursor-pointer mt-2"
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Salvando…' : 'Salvar nova senha'}
          </PrimaryButton>

          <SecondaryButton
            type="button"
            size="sm"
            onClick={() => goTo('login')}
            className="w-full cursor-pointer mt-2"
          >
            Entrar com minha conta
          </SecondaryButton>
        </form>
      </div>
    );
  }

  // ==========================================
  // SCREEN: FORGOT PASSWORD
  // ==========================================
  if (screen === 'forgot') {
    return shell(
      <div className="space-y-6">
        <ButtonBase
          type="button"
          onClick={() => goTo('login')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[var(--mazzi-dark)] transition cursor-pointer rounded-lg p-1 -ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mazzi-dark)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para o login</span>
        </ButtonBase>

        <div className="space-y-2">
          <p className="mazzi-eyebrow">{brandTag}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight">
            Recuperar senha
          </h1>
          <p className="text-sm text-slate-600">
            Informe seu e-mail cadastrado para receber um código de {AUTH_OTP_LENGTH} dígitos.
          </p>
        </div>

        {feedback && (
          <div
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-semibold ${
              feedback.tone === 'error'
                ? 'bg-rose-50 border border-rose-200/60 text-rose-700'
                : 'bg-emerald-50 border border-emerald-200/60 text-emerald-800'
            }`}
          >
            {feedback.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <form noValidate onSubmit={submitForgot} className="space-y-4">
          <Input
            id="forgot-email"
            type="email"
            label="E-mail cadastrado"
            placeholder="exemplo@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
            error={errors.email}
            autoComplete="email"
            disabled={isLoading}
          />

          <PrimaryButton
            type="submit"
            size="sm"
            className="w-full font-bold shadow-xs cursor-pointer mt-2"
            disabled={isLoading}
            isLoading={isLoading}
          >
            Enviar código
          </PrimaryButton>

          {feedback?.tone === 'error' && feedback.message.includes('não está cadastrado') && (
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => goTo('signup')}
              className="w-full min-h-[48px] font-bold cursor-pointer mt-2"
            >
              Criar minha conta no MAZZI
            </SecondaryButton>
          )}
        </form>
      </div>
    );
  }

  // ==========================================
  // SCREEN: STUDENT SIGNUP
  // ==========================================
  if (screen === 'signup') {
    return shell(
      <div className="space-y-6">
        <ButtonBase
          type="button"
          onClick={() => goTo('login')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[var(--mazzi-dark)] transition cursor-pointer rounded-lg p-1 -ml-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mazzi-dark)]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para o login</span>
        </ButtonBase>

        <div className="space-y-2">
          <p className="mazzi-eyebrow">{brandTag}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight">
            Criar conta
          </h1>
          <p className="text-sm text-slate-600">
            Preencha seus dados para começar suas aulas no MAZZI.
          </p>
        </div>

        {activeError && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/60 text-xs font-semibold text-rose-700 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
            <span>{activeError}</span>
          </div>
        )}

        <form noValidate onSubmit={submitSignup} className="space-y-4">
          <Input
            id="signup-name"
            label="Nome completo"
            placeholder="Como no documento oficial"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            error={errors.name}
            autoComplete="name"
            disabled={isLoading}
          />

          <Input
            id="signup-email"
            type="email"
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
            error={errors.email}
            autoComplete="email"
            disabled={isLoading}
          />

          <Input
            id="signup-phone"
            type="tel"
            inputMode="numeric"
            label="Celular com DDD"
            placeholder="(11) 98765-4321"
            value={formatPhone(phone)}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError('phone');
            }}
            error={errors.phone}
            maxLength={15}
            autoComplete="tel"
            disabled={isLoading}
          />

          <Input
            id="signup-cpf"
            type="text"
            inputMode="numeric"
            label="CPF"
            placeholder="000.000.000-00"
            value={formatCpf(cpf)}
            onChange={(e) => {
              setCpf(e.target.value);
              clearError('cpf');
            }}
            error={errors.cpf}
            maxLength={14}
            disabled={isLoading}
            hint="Apenas números ou formatado"
          />

          <Input
            id="signup-birthdate"
            type="text"
            inputMode="numeric"
            label="Data de nascimento"
            placeholder="DD/MM/AAAA"
            value={formatDateMask(birthDate)}
            onChange={(e) => {
              setBirthDate(e.target.value);
              clearError('birthDate');
            }}
            error={errors.birthDate}
            maxLength={10}
            disabled={isLoading}
            hint="Idade mínima: 18 anos completos (DD/MM/AAAA)"
          />

          <PasswordInput
            id="signup-password"
            label="Senha de acesso"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
            }}
            error={errors.password}
            autoComplete="new-password"
            disabled={isLoading}
            hint="Mínimo de 8 caracteres"
          />

          <PasswordInput
            id="signup-confirm-password"
            label="Confirmar senha"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              clearError('confirmPassword');
            }}
            error={errors.confirmPassword}
            autoComplete="new-password"
            disabled={isLoading}
          />

          <PrimaryButton
            type="submit"
            size="sm"
            className="w-full font-bold shadow-xs cursor-pointer mt-2"
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Criando conta…' : 'Criar conta'}
          </PrimaryButton>

          <p className="text-center text-xs text-slate-500 pt-2">
            Já tem uma conta?{' '}
            <ButtonBase
              type="button"
              onClick={() => goTo('login')}
              className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-amber-700 underline underline-offset-2 hover:text-amber-800"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Fazer login
            </ButtonBase>
          </p>
        </form>
      </div>
    );
  }

  // ==========================================
  // SCREEN: LOGIN (DEFAULT)
  // ==========================================
  return shell(
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="mazzi-eyebrow">{brandTag}</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight">
          {kind === 'student'
            ? 'Entrar no MAZZI'
            : kind === 'instructor'
            ? 'Portal do Instrutor'
            : 'Administração'}
        </h1>
        <p className="text-sm text-slate-600">
          {kind === 'student'
            ? 'Acesse para agendar suas aulas práticas.'
            : kind === 'instructor'
            ? 'Gerencie sua agenda, alunos e ganhos.'
            : 'Controle de operações e credenciamento.'}
        </p>
      </div>

      {activeError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/60 text-xs font-semibold text-rose-700 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
          <span>{activeError}</span>
        </div>
      )}

      {feedback?.tone === 'success' && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-xs font-semibold text-emerald-800 flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
          <span>{feedback.message}</span>
        </div>
      )}

      <form noValidate onSubmit={submitLogin} className="space-y-4">
        <Input
          id="login-email"
          type="email"
          label="E-mail"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email');
          }}
          error={errors.email}
          autoComplete="email"
          disabled={isLoading}
        />

        <PasswordInput
          id="login-password"
          label="Senha"
          placeholder="••••••••"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clearError('password');
          }}
          error={errors.password}
          autoComplete="current-password"
          disabled={isLoading}
          rightAction={
            <ButtonBase
              type="button"
              onClick={() => goTo('forgot')}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Esqueceu sua senha?
            </ButtonBase>
          }
        />

        <PrimaryButton
          type="submit"
          size="sm"
          className="w-full font-bold shadow-xs cursor-pointer mt-2"
          disabled={isLoading}
          loading={isLoading}
        >
          {isLoading ? 'Entrando…' : 'Entrar'}
        </PrimaryButton>

        {kind === 'student' && (
          <p className="text-center text-xs text-slate-600 pt-2">
            Ainda não tem conta?{' '}
            <ButtonBase
              type="button"
              onClick={() => goTo('signup')}
              className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-amber-700 underline underline-offset-2 hover:text-amber-800"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Criar conta
            </ButtonBase>
          </p>
        )}
      </form>

      {import.meta.env.DEV &&
        import.meta.env.VITE_ENABLE_DEV_QUICK_LOGIN === 'true' &&
        typeof DevQuickLogin === 'function' && (
          <div className="pt-2">
            <DevQuickLogin
              kind={kind}
              onError={(msg) => setFeedback({ tone: 'error', message: formatAuthError(msg) })}
            />
          </div>
        )}
    </div>
  );
};

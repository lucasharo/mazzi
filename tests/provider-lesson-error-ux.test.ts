import { describe, it, expect } from 'vitest';
import { mapFriendlyErrorMessage } from '../src/lib/error-mapper';

describe('TASK-051 — Provider Lesson Lifecycle Error Mapping & UX Unit Tests', () => {
  it('A. CHECKIN_WINDOW_NOT_OPEN returns friendly message without technical code', () => {
    const rawError = {
      message: 'CHECKIN_WINDOW_NOT_OPEN: O check-in só pode ser feito a partir de 30 minutos antes do início da aula.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível realizar o check-in.');
    expect(friendly).toBe('O check-in ainda não está disponível. Aguarde a abertura da janela de check-in.');
    expect(friendly).not.toContain('CHECKIN_WINDOW_NOT_OPEN');
  });

  it('B. CHECKIN_WINDOW_EXPIRED returns friendly message without technical code', () => {
    const rawError = new Error('CHECKIN_WINDOW_EXPIRED: A janela para realizar check-in desta aula expirou.');
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível realizar o check-in.');
    expect(friendly).toBe('A janela de check-in desta aula já terminou.');
    expect(friendly).not.toContain('CHECKIN_WINDOW_EXPIRED');
  });

  it('C. CHECKIN_REQUIRED returns friendly message without technical code', () => {
    const rawError = {
      message: 'CHECKIN_REQUIRED: O check-in do instrutor deve ser realizado antes de iniciar a aula.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível iniciar a aula.');
    expect(friendly).toBe('Faça o check-in antes de iniciar a aula.');
    expect(friendly).not.toContain('CHECKIN_REQUIRED');
  });

  it('D. Invalid instructor compliance at lesson start explains why the action is blocked', () => {
    const rawError = {
      code: '42501',
      message: 'INSTRUCTOR_COMPLIANCE_INVALID_AT_LESSON_START',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível iniciar a aula.');
    expect(friendly).toBe('Não é possível iniciar a aula porque a documentação de compliance do instrutor não está válida no momento. Regularize os documentos no PRO e aguarde a aprovação administrativa.');
    expect(friendly).not.toContain('42501');
    expect(friendly).not.toContain('INSTRUCTOR_COMPLIANCE_INVALID_AT_LESSON_START');
  });

  it('E. INVALID_STATUS returns friendly message without technical code', () => {
    const rawError = {
      message: 'INVALID_STATUS: Somente aulas em andamento (IN_PROGRESS) podem ser concluídas.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível concluir a aula.');
    expect(friendly).toBe('Esta ação não está disponível no estado atual da aula.');
    expect(friendly).not.toContain('INVALID_STATUS');
  });

  it('F. COMPLETION_IDEMPOTENCY_KEY_REQUIRED returns friendly message without technical code', () => {
    const rawError = {
      message: 'COMPLETION_IDEMPOTENCY_KEY_REQUIRED: A chave de idempotência é obrigatória para concluir a aula.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível concluir a aula.');
    expect(friendly).toBe('Não foi possível concluir a aula com segurança. Tente novamente.');
    expect(friendly).not.toContain('COMPLETION_IDEMPOTENCY_KEY_REQUIRED');
  });

  it('G. IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST with code 23505 returns friendly message without technical code or SQLSTATE', () => {
    const rawError = {
      code: '23505',
      message: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: A chave de idempotência informada diverge da utilizada na conclusão deste agendamento.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Não foi possível concluir a aula.');
    expect(friendly).toBe('Esta aula já recebeu uma solicitação de conclusão diferente. Atualize os dados antes de tentar novamente.');
    expect(friendly).not.toContain('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    expect(friendly).not.toContain('23505');
  });

  it('H. Generic 23505 duplicate key error WITHOUT idempotency message is NOT incorrectly classified as lesson completion conflict', () => {
    const genericUniqueError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_email_key"',
      details: 'Key (email)=(test@example.com) already exists.',
    };
    const friendly = mapFriendlyErrorMessage(genericUniqueError, 'Erro ao salvar registro.');
    expect(friendly).toBe('Erro ao salvar registro.');
    expect(friendly).not.toContain('Esta aula já recebeu uma solicitação de conclusão diferente');
    expect(friendly).not.toContain('23505');
  });

  it('I. UNAUTHORIZED_PROVIDER returns friendly authorization message without technical code', () => {
    const rawError = {
      message: 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o responsável por este agendamento.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Acesso negado.');
    expect(friendly).toBe('Você não tem permissão para realizar esta ação neste agendamento.');
    expect(friendly).not.toContain('UNAUTHORIZED_PROVIDER');
  });

  it('J. BOOKING_NOT_FOUND returns friendly message without technical code', () => {
    const rawError = {
      message: 'BOOKING_NOT_FOUND: Agendamento não encontrado.',
    };
    const friendly = mapFriendlyErrorMessage(rawError, 'Agendamento não encontrado.');
    expect(friendly).toBe('Este agendamento não foi encontrado ou não está mais disponível.');
    expect(friendly).not.toContain('BOOKING_NOT_FOUND');
  });

  it('K. Unknown error returns provided fallbackMessage without technical dump', () => {
    const unknownError = {
      code: 'PGRST999',
      message: 'postgres internal crash dump xyz',
    };
    const friendly = mapFriendlyErrorMessage(unknownError, 'Não foi possível realizar o check-in.');
    expect(friendly).toBe('Não foi possível realizar o check-in.');
    expect(friendly).not.toContain('PGRST999');
    expect(friendly).not.toContain('postgres');
  });

  it('L. Raw English errors are replaced with the Portuguese fallback', () => {
    const friendly = mapFriendlyErrorMessage(
      { message: 'For security purposes, you can only request this after 9 seconds.' },
      'Não foi possível reenviar o código agora.',
    );
    expect(friendly).toBe('Para sua segurança, aguarde 9 segundos antes de tentar novamente.');
  });
});

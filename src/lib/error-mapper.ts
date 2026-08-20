/**
 * MAZZI PLATFORM — FRIENDLY ERROR MAPPER
 * Converts raw Supabase/PostgreSQL/Domain errors into clean, human-friendly Portuguese messages.
 */

export function mapFriendlyErrorMessage(err: any, fallbackMessage: string = 'Ocorreu um erro ao processar a operação.'): string {
  if (!err) return fallbackMessage;

  const msg = typeof err === 'string' ? err : err.message || err.details || err.hint || '';
  const code = err.code || err.statusCode || '';

  // 1. Provider Lesson Lifecycle Specific Errors (TASK-051)
  if (msg.includes('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')) {
    return 'Esta aula já recebeu uma solicitação de conclusão diferente. Atualize os dados antes de tentar novamente.';
  }

  if (msg.includes('COMPLETION_IDEMPOTENCY_KEY_REQUIRED')) {
    return 'Não foi possível concluir a aula com segurança. Tente novamente.';
  }

  if (msg.includes('CHECKIN_WINDOW_NOT_OPEN')) {
    return 'O check-in ainda não está disponível. Aguarde a abertura da janela de check-in.';
  }

  if (msg.includes('CHECKIN_WINDOW_EXPIRED')) {
    return 'A janela de check-in desta aula já terminou.';
  }

  if (msg.includes('CHECKIN_REQUIRED')) {
    return 'Faça o check-in antes de iniciar a aula.';
  }

  if (msg.includes('UNAUTHORIZED_PROVIDER') || msg.includes('UNAUTHORIZED_STUDENT')) {
    return 'Você não tem permissão para realizar esta ação neste agendamento.';
  }

  if (msg.includes('UNAUTHENTICATED')) {
    return 'Sua sessão expirou. Entre novamente para continuar.';
  }

  if (msg.includes('BOOKING_NOT_FOUND')) {
    return 'Este agendamento não foi encontrado ou não está mais disponível.';
  }

  if (msg.includes('INVALID_STATUS')) {
    return 'Esta ação não está disponível no estado atual da aula.';
  }

  if (msg.includes('BOOKING_CATEGORY_MISSING')) {
    return 'Inconsistência nos dados do agendamento. Categoria não localizada.';
  }

  // 2. RLS / Authorization / 403 Errors
  if (code === '42501' || msg.includes('permission denied') || msg.includes('row-level security') || msg.includes('ACCESS_DENIED') || msg.includes('UNAUTHORIZED')) {
    return 'Você não tem permissão para realizar esta ação neste perfil.';
  }

  // 3. Format / UUID / Invalid Input / 400 Errors
  if (code === '22P02' || msg.includes('invalid input syntax for type uuid')) {
    return 'Identificador de registro inválido ou dados corrompidos.';
  }

  // 4. Domain Specific Errors
  if (msg.includes('INVALID_LICENSE_PLATE') || msg.includes('Placa do veículo inválida')) {
    return 'Informe uma placa de veículo válida (Padrão Mercosul ou Tradicional BR).';
  }

  if (msg.includes('INVALID_VEHICLE_YEAR') || msg.includes('Ano do veículo inválido')) {
    return 'Ano do veículo inválido. O ano deve ser entre 1990 e o ano subsequente.';
  }

  if (msg.includes('INVALID_MONEY_FORMAT') || msg.includes('Valor monetário inválido')) {
    return 'Informe um preço válido em Reais (Ex: R$ 95,00).';
  }

  if (msg.includes('SERVICE_RADIUS_INVALID')) {
    return 'O raio de atendimento deve ser um valor entre 1 e 100 km.';
  }

  // 5. Global Block Specific Errors (TASK-054E)
  if (msg.includes('GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED')) {
    return 'Bloqueio pessoal não localizado ou sem permissão.';
  }
  if (msg.includes('UNAUTHORIZED_ROLE')) {
    return 'Você não possui permissão de instrutor para realizar esta ação.';
  }
  if (msg.includes('USER_INACTIVE')) {
    return 'Seu usuário está inativo no sistema.';
  }
  if (msg.includes('AUTHENTICATION_REQUIRED')) {
    return 'Sua sessão expirou. Entre novamente para continuar.';
  }
  if (msg.includes('INVALID_TIME_RANGE')) {
    return 'A data e hora final devem ser posteriores à data e hora inicial.';
  }

  // 6. Technical Error Check & Fallback Guard
  const isTechnicalMsg =
    /^[A-Z0-9_]+$/.test(msg.trim()) ||
    msg.includes('PGRST') ||
    msg.includes('postgres') ||
    msg.includes('duplicate key') ||
    msg.includes('violates') ||
    msg.includes('Constraint') ||
    msg.includes('ERRCODE') ||
    msg.includes('RAISE EXCEPTION') ||
    msg.includes('DATABASE') ||
    msg.includes('CONNECTION') ||
    msg.includes('TIMEOUT') ||
    msg.includes('NETWORK') ||
    msg.includes('FETCH_ERROR');

  if (!isTechnicalMsg && msg && !msg.includes('{') && !msg.includes('}')) {
    return msg;
  }

  return fallbackMessage;
}

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

  if (msg.includes('INSTRUCTOR_CHECKIN_REQUIRED')) {
    return 'Faça seu check-in antes de iniciar a aula.';
  }
  if (msg.includes('STUDENT_CHECKIN_REQUIRED')) {
    return 'O aluno precisa realizar o check-in antes do início da aula.';
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

  if (msg.includes('OFFERING_VEHICLE_ATTRIBUTES_MISMATCH')) {
    return 'Os dados da oferta não correspondem ao veículo selecionado. Atualize a tela e tente novamente.';
  }

  if (msg.includes('OFFERING_PROVIDER_NOT_ACTIVE')) {
    return 'O cadastro do prestador ainda não está aprovado. Conclua o onboarding e aguarde a validação administrativa para publicar ofertas.';
  }

  if (msg.includes('OFFERING_VEHICLE_NOT_ACTIVE')) {
    return 'O veículo selecionado ainda não está aprovado. Aguarde a validação administrativa antes de publicar esta oferta.';
  }

  if (msg.includes('OFFERING_INSTRUCTOR_NOT_ELIGIBLE')) {
    return 'O instrutor selecionado ainda não está elegível para esta oferta. Verifique o vínculo e os documentos de compliance.';
  }

  if (msg.includes('DUPLICATE_ACTIVE_OFFERING') || msg.includes('DUPLICATE_OFFERING_EXISTS')) {
    return 'Já existe uma oferta ativa para este veículo, categoria e transmissão.';
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
  if (msg.includes('EMERGENCY_BLOCK_BOOKING_CONFLICT')) {
    return 'Existe uma aula ou reserva ativa neste período. Para proteger o aluno, esse horário não pode ser bloqueado.';
  }
  if (msg.includes('EMERGENCY_BLOCK_IN_PAST')) {
    return 'Escolha um horário futuro para criar o bloqueio rápido.';
  }
  if (msg.includes('EMERGENCY_BLOCK_INVALID_RANGE')) {
    return 'A hora final deve ser posterior à hora inicial.';
  }
  if (msg.includes('AVAILABILITY_BLOCK_BOOKING_CONFLICT')) {
    return 'Existe uma aula ou reserva ativa em um dos dias selecionados. Ajuste o período antes de criar o bloqueio.';
  }
  if (msg.includes('SLOT_NO_LONGER_AVAILABLE')) {
    return 'Esse horário não está mais disponível. Escolha outro horário.';
  }
  if (msg.includes('ACTIVE_STUDENT_BOOKING')) {
    return 'Finalize ou aguarde suas aulas ativas antes de ativar o perfil profissional.';
  }
  if (msg.includes('PENDING_STUDENT_PAYMENT')) {
    return 'Existe um pagamento de aula pendente. Conclua ou aguarde a expiração antes de ativar o perfil profissional.';
  }
  if (msg.includes('STUDENT_DISPUTE_OPEN')) {
    return 'Existe uma contestação de aula em aberto. Resolva-a antes de ativar o perfil profissional.';
  }
  if (msg.includes('IDENTITY_INCOMPLETE')) {
    return 'Complete seus dados de identidade antes de ativar o perfil profissional.';
  }
  if (msg.includes('STUDENT_TO_PRO_ROLE_CONFLICT')) {
    return 'Esta conta possui uma função incompatível com a ativação do perfil profissional.';
  }

  if (msg.includes('SELF_BOOKING_NOT_ALLOWED')) {
    return 'Você não pode contratar uma aula com o seu próprio perfil profissional.';
  }

  if (msg.toLowerCase().includes('for security purposes') && msg.toLowerCase().includes('request this after')) {
    const seconds = msg.match(/after\s+(\d+)\s+seconds?/i)?.[1];
    return `Para sua segurança, aguarde ${seconds ? `${seconds} segundos` : 'alguns instantes'} antes de tentar novamente.`;
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

  const isUntranslatedMessage = /\b(?:the|this|that|for|security|request|after|seconds?|failed|error|invalid|permission|not found|unable|could not|please|try again)\b/i.test(msg);

  if (!isTechnicalMsg && !isUntranslatedMessage && msg && !msg.includes('{') && !msg.includes('}')) {
    return msg;
  }

  return fallbackMessage;
}

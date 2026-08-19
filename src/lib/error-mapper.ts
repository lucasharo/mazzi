/**
 * MAZZI PLATFORM — FRIENDLY ERROR MAPPER
 * Converts raw Supabase/PostgreSQL/Domain errors into clean, human-friendly Portuguese messages.
 */

export function mapFriendlyErrorMessage(err: any, fallbackMessage: string = 'Ocorreu um erro ao processar a operação.'): string {
  if (!err) return fallbackMessage;

  const msg = typeof err === 'string' ? err : err.message || err.details || err.hint || '';
  const code = err.code || err.statusCode || '';

  // 1. RLS / Authorization / 403 Errors
  if (code === '42501' || msg.includes('permission denied') || msg.includes('row-level security') || msg.includes('ACCESS_DENIED') || msg.includes('UNAUTHORIZED')) {
    return 'Você não tem permissão para realizar esta ação neste perfil.';
  }

  // 2. Format / UUID / Invalid Input / 400 Errors
  if (code === '22P02' || msg.includes('invalid input syntax for type uuid')) {
    return 'Identificador de registro inválido ou dados corrompidos.';
  }

  // 3. Domain Specific Errors
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

  if (msg.includes('BOOKING_HOLD_EXPIRED')) {
    return 'Tempo para pagamento expirado. O agendamento foi cancelado.';
  }

  // If already clean Portuguese message without technical dump, return it
  if (msg && !msg.includes('PGRST') && !msg.includes('postgres') && !msg.includes('duplicate key') && !msg.includes('violates') && !msg.includes('Constraint')) {
    return msg;
  }

  return fallbackMessage;
}

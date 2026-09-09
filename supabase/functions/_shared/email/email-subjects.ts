import type { EmailTemplateName } from './email-types.ts';

export const EMAIL_SUBJECTS: Record<EmailTemplateName, string> = {
  'student-payment-confirmed': 'Pagamento confirmado — sua aula está agendada',
  'student-cancellation-refund': 'Cancelamento confirmado — seu estorno foi solicitado',
  'student-refund-completed': 'Seu estorno foi concluído',
  'pro-booking-confirmed': 'Nova aula confirmada no MAZZI',
  'pro-payout-completed': 'Seu repasse foi realizado',
};

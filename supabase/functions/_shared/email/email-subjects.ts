import type { EmailTemplateName } from './email-types.ts';

export const EMAIL_SUBJECTS: Record<EmailTemplateName, string> = {
  'student-payment-confirmed': 'Pagamento confirmado \u2014 sua aula est\u00e1 agendada',
  'student-cancellation-refund': 'Cancelamento confirmado \u2014 seu estorno foi solicitado',
  'student-refund-completed': 'Seu estorno foi conclu\u00eddo',
  'pro-booking-confirmed': 'Nova aula confirmada no MAZZI',
  'pro-payout-completed': 'Seu repasse foi realizado',
};

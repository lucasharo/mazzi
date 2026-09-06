import type { NotificationAppContext, NotificationType } from '../types';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  MessageCircle,
  Navigation,
  Star,
} from 'lucide-react';

export interface NotificationPreferenceDefinition {
  type: NotificationType;
  label: string;
  description: string;
  icon: LucideIcon;
  contexts: readonly NotificationAppContext[];
}

const STUDENT_CONTEXTS = ['STUDENT'] as const satisfies readonly NotificationAppContext[];
const PRO_CONTEXTS = ['PRO'] as const satisfies readonly NotificationAppContext[];
const BOTH_CONTEXTS = ['STUDENT', 'PRO'] as const satisfies readonly NotificationAppContext[];

/** Canonical notification catalog shared by the Student and PRO profiles. */
export const NOTIFICATION_PREFERENCE_DEFINITIONS: readonly NotificationPreferenceDefinition[] = [
  { type: 'BOOKING_CONFIRMED', label: 'Aulas confirmadas', description: 'Quando uma aula for confirmada.', icon: CalendarIcon, contexts: BOTH_CONTEXTS },
  { type: 'BOOKING_CANCELLED', label: 'Cancelamentos de aulas', description: 'Quando uma aula for cancelada.', icon: AlertCircle, contexts: BOTH_CONTEXTS },
  { type: 'NEW_MESSAGE', label: 'Novas mensagens', description: 'Quando chegar uma mensagem sobre uma aula.', icon: MessageCircle, contexts: BOTH_CONTEXTS },
  { type: 'STUDENT_CHECKIN', label: 'Check-in do aluno', description: 'Quando o aluno fizer check-in ou houver atualização desse evento.', icon: CheckCircle2, contexts: PRO_CONTEXTS },
  { type: 'PROVIDER_CHECKIN', label: 'Check-in do PRO', description: 'Quando o PRO fizer check-in ou houver atualização desse evento.', icon: CheckCircle2, contexts: STUDENT_CONTEXTS },
  { type: 'PROVIDER_ON_THE_WAY', label: 'PRO a caminho', description: 'Quando o PRO informar que está a caminho.', icon: Navigation, contexts: STUDENT_CONTEXTS },
  { type: 'LESSON_STARTED', label: 'Aulas iniciadas', description: 'Quando uma aula começar.', icon: Clock3, contexts: BOTH_CONTEXTS },
  { type: 'LESSON_COMPLETED', label: 'Aulas concluídas', description: 'Quando uma aula for concluída.', icon: CheckCircle2, contexts: BOTH_CONTEXTS },
  { type: 'CONTESTATION_UPDATED', label: 'Atualizações de contestação', description: 'Quando houver mudança em uma contestação.', icon: AlertCircle, contexts: BOTH_CONTEXTS },
  { type: 'COMPLIANCE_PENDING', label: 'Pendências de compliance', description: 'Quando houver uma pendência no credenciamento.', icon: FileCheck2, contexts: PRO_CONTEXTS },
  { type: 'PAYOUT_PAID', label: 'Recebimentos pagos', description: 'Quando um recebimento for liberado ou pago.', icon: CircleDollarSign, contexts: PRO_CONTEXTS },
  { type: 'PAYOUT_BLOCKED', label: 'Recebimentos bloqueados', description: 'Quando um recebimento for bloqueado.', icon: CircleDollarSign, contexts: PRO_CONTEXTS },
  { type: 'PAYOUT_FAILED', label: 'Falhas no recebimento', description: 'Quando houver falha em um recebimento.', icon: CircleDollarSign, contexts: PRO_CONTEXTS },
  { type: 'INSTANT_LESSON_OFFER', label: 'Ofertas de Aula Agora', description: 'Quando surgir uma solicitação de Aula Agora.', icon: CarFront, contexts: PRO_CONTEXTS },
  { type: 'REVIEW_AVAILABLE', label: 'Avaliações disponíveis', description: 'Quando uma aula estiver disponível para avaliação.', icon: Star, contexts: STUDENT_CONTEXTS },
  { type: 'REVIEW_RECEIVED', label: 'Avaliações recebidas', description: 'Quando um aluno enviar uma avaliação.', icon: Star, contexts: PRO_CONTEXTS },
];

export function getNotificationPreferenceDefinitions(appContext: NotificationAppContext): NotificationPreferenceDefinition[] {
  return NOTIFICATION_PREFERENCE_DEFINITIONS.filter((definition) => definition.contexts.includes(appContext));
}

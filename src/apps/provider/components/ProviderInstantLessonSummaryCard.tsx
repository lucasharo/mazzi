import React, { useEffect, useState } from 'react';
import { Clock3, Settings2 } from 'lucide-react';
import type { InstantLessonInstructorStatus, InstantLessonSettings } from '../../../types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { InstantLessonAvailabilityNotice } from '../../../components/instant/InstantLessonAvailabilityNotice';
import { formatInstantInstructorAvailability, isInstantInstructorAvailabilityActive } from '../../../domain/instant-lesson';
import type { InstantLessonAvailabilityNotice as InstantLessonAvailabilityNoticeData } from '../../../domain/instant-lesson';

interface ProviderInstantLessonSummaryCardProps {
  settings?: InstantLessonSettings[];
  providerId?: string;
  instructorStatuses?: InstantLessonInstructorStatus[];
  currentUserId?: string;
  availabilityNotice?: InstantLessonAvailabilityNoticeData | null;
  onOpenSettings: () => void;
}

export const ProviderInstantLessonSummaryCard: React.FC<ProviderInstantLessonSummaryCardProps> = ({ settings = [], providerId, instructorStatuses = [], currentUserId, availabilityNotice, onOpenSettings }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (availabilityNotice) return <InstantLessonAvailabilityNotice notice={availabilityNotice} />;

  const enabledSettings = settings.filter((setting) => setting.instantEnabled);
  const instructorStatus = currentUserId ? instructorStatuses.find((status) => status.providerId === providerId && status.instructorId === currentUserId) : undefined;
  const isAvailable = instructorStatus ? isInstantInstructorAvailabilityActive(instructorStatus, now) : false;
  const isConfigured = enabledSettings.length > 0;
  const availabilityLabel = instructorStatus ? formatInstantInstructorAvailability(instructorStatus, now) : null;

  const status = !currentUserId || !instructorStatus
    ? { label: 'Por instrutor', variant: 'neutral' as const, description: 'A disponibilidade é controlada individualmente por cada instrutor.' }
    : isAvailable
      ? { label: 'Disponível', variant: 'success' as const, description: `${availabilityLabel || 'Você está disponível'} para receber solicitações imediatas.` }
      : instructorStatus.instantOnline && instructorStatus.onlineExpiresAt
        ? { label: 'Expirada', variant: 'warning' as const, description: 'Sua disponibilidade da Aula Agora expirou. Ative novamente para receber novas solicitações.' }
        : isConfigured
      ? { label: 'Pausada', variant: 'warning' as const, description: 'A Aula Agora está configurada, mas pausada no momento.' }
      : { label: 'Desativada', variant: 'neutral' as const, description: 'Ative uma oferta para começar a receber aulas imediatas.' };

  return (
    <section className="mazzi-card rounded-2xl border border-amber-200 bg-amber-50/80 p-4" aria-labelledby="provider-instant-summary-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs">
          <Clock3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="provider-instant-summary-title" className="text-base font-extrabold text-[var(--mazzi-dark)]">Aula Agora</h2>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{status.description}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-amber-200/80 pt-3">
        <p className="min-w-0 flex-1 text-xs font-semibold text-amber-900">Configure ofertas, preço e distância de atendimento.</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenSettings}
          leftIcon={<Settings2 className="h-4 w-4" aria-hidden="true" />}
        >
          Configurar
        </Button>
      </div>
    </section>
  );
};

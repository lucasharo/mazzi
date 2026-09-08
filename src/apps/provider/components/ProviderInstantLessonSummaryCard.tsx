import React, { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import type { InstantLessonInstructorStatus, InstantLessonSettings } from '../../../types';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { CountdownTimer } from '../../../components/ui/CountdownTimer';
import { InstantLessonAvailabilityNotice } from '../../../components/instant/InstantLessonAvailabilityNotice';
import { isInstantInstructorAvailabilityActive } from '../../../domain/instant-lesson';
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
  const availabilitySecondsLeft = isAvailable && instructorStatus?.onlineExpiresAt
    ? Math.max(0, Math.ceil((new Date(instructorStatus.onlineExpiresAt).getTime() - now) / 1000))
    : null;

  const status = !currentUserId || !instructorStatus
    ? { label: 'Por instrutor', variant: 'neutral' as const, description: 'A disponibilidade é controlada individualmente por cada instrutor.' }
    : isAvailable
      ? { label: 'Disponível', variant: 'success' as const, description: 'Pronto para receber solicitações imediatas.' }
      : instructorStatus.instantOnline && instructorStatus.onlineExpiresAt
        ? { label: 'Expirada', variant: 'danger' as const, description: 'Sua disponibilidade da Aula Agora expirou. Ative novamente para receber novas solicitações.' }
        : isConfigured
      ? { label: 'Pausada', variant: 'danger' as const, description: 'Configure preço e distância de atendimento.' }
      : { label: 'Desativada', variant: 'danger' as const, description: 'Ative uma oferta para começar a receber aulas imediatas.' };

  const statusBadgeClassName = status.variant === 'neutral' ? 'border border-white/20 bg-white/10 text-white' : '';

  return (
    <section className="mazzi-compact-card rounded-2xl border border-white/10 bg-[var(--mazzi-dark)] p-4 shadow-sm" aria-labelledby="provider-instant-summary-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs">
          <Clock3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="provider-instant-summary-title" className="text-base font-extrabold text-white">Aula Agora</h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-white/70">{status.description}</p>
          </div>
          <Badge variant={status.variant} className={`shrink-0 rounded-full ${statusBadgeClassName}`}>{status.label}</Badge>
        </div>
      </div>

      {availabilitySecondsLeft !== null && (
        <CountdownTimer secondsRemaining={availabilitySecondsLeft} label="Disponível por mais" className="mt-4" />
      )}

      <div className="mt-4 border-t border-white/15 pt-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full"
          onClick={onOpenSettings}
          leftIcon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
        >
          Aula Agora
        </Button>
      </div>
    </section>
  );
};

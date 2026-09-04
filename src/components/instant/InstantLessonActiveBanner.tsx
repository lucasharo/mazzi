import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Navigation } from 'lucide-react';
import type { Booking } from '../../types';
import { Button } from '../ui/Button';
import { formatCentsToBRL } from '../../domain/money';
import { formatMeetingPoint } from '../../lib/meeting-point';

export type InstantLessonOperationalState =
  | 'WAITING_PAYMENT'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS';

interface InstantLessonActiveBannerProps {
  booking: Booking;
  operationalState: InstantLessonOperationalState;
  onOpenDetails: () => void;
  distanceKm?: number | null;
  etaMinutes?: number | null;
}

export const InstantLessonActiveBanner: React.FC<InstantLessonActiveBannerProps> = ({
  booking,
  operationalState,
  onOpenDetails,
  distanceKm,
  etaMinutes,
}) => {
  const meetingPointText = formatMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint) || booking.fullMeetingPoint || 'Ponto de encontro da aula';
  const priceFormatted = formatCentsToBRL(booking.totalInCents || booking.priceInCents || 0);
  const studentName = booking.studentName || 'Aluno';

  if (operationalState === 'WAITING_PAYMENT') {
    return (
      <div
        role="region"
        aria-label="Alerta de Aula Agora aguardando pagamento"
        className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 shadow-xs transition-colors"
        data-component="instant-active-banner"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-amber-900">
              <Clock3 className="h-5 w-5 animate-pulse" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-950">
                  Aula Agora Aceita
                </span>
                <span className="text-xs font-semibold text-amber-900">Aguardando pagamento do aluno</span>
              </div>
              <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900">
                {studentName} • {priceFormatted} • <span className="font-semibold text-slate-600">{meetingPointText}</span>
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenDetails}
            className="border-amber-300 bg-white font-extrabold text-amber-950 hover:bg-amber-100"
            rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Ver detalhes
          </Button>
        </div>
      </div>
    );
  }

  if (operationalState === 'CONFIRMED' || operationalState === 'ON_THE_WAY') {
    const isConfirmed = operationalState === 'CONFIRMED';
    return (
      <div
        role="region"
        aria-label="Alerta de Aula Agora confirmada"
        className="shrink-0 border-b border-emerald-300 bg-emerald-50 px-4 py-3 shadow-sm transition-colors"
        data-component="instant-active-banner"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              {isConfirmed ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Navigation className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  {isConfirmed ? 'Pagamento Confirmado!' : 'Você está a caminho'}
                </span>
                {distanceKm != null && etaMinutes != null && (
                  <span className="text-xs font-bold text-emerald-900">
                    {distanceKm} km • aprox. {etaMinutes} min ETA
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs font-extrabold text-slate-950">
                Aluno: {studentName} • <span className="font-semibold text-slate-700">{meetingPointText}</span>
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onOpenDetails}
            className="bg-[var(--mazzi-dark)] font-extrabold text-white hover:bg-slate-800"
            rightIcon={<ArrowRight className="h-4 w-4 text-[var(--mazzi-yellow)]" aria-hidden="true" />}
          >
            {isConfirmed ? 'Ir para a aula' : 'Ver aula'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

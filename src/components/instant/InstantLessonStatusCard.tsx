import React from 'react';
import { Loader2, MapPin, XCircle } from 'lucide-react';
import type { InstantLessonRequest } from '../../types';
import { Button } from '../ui/Button';
import { formatInstantStatus } from '../../domain/instant-lesson';

interface InstantLessonStatusCardProps {
  request: InstantLessonRequest;
  onCancel?: () => void;
  isCancelling?: boolean;
  paymentConfirmed?: boolean;
}

export const InstantLessonStatusCard: React.FC<InstantLessonStatusCardProps> = ({ request, onCancel, isCancelling, paymentConfirmed }) => {
  const searching = request.status === 'SEARCHING';
  return (
    <section className={`rounded-3xl border p-4 ${paymentConfirmed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${paymentConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]'}`}>
          {searching ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <MapPin className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h3 className="font-extrabold text-[var(--mazzi-dark)]">{formatInstantStatus(request.status)}</h3>
          <p className="mt-1 text-sm font-medium text-slate-600">{paymentConfirmed ? 'Pagamento confirmado. Acompanhe a localização do profissional.' : searching ? 'Estamos procurando alguém próximo que atenda aos seus critérios.' : request.status === 'MATCHED' ? 'Seu profissional foi encontrado.' : 'Você pode iniciar uma nova busca quando quiser.'}</p>
        </div>
      </div>
      {searching && onCancel && <div className="mt-4 flex justify-end"><Button type="button" variant="outline" size="sm" leftIcon={<XCircle className="h-4 w-4" />} onClick={onCancel} isLoading={isCancelling}>Cancelar busca</Button></div>}
    </section>
  );
};

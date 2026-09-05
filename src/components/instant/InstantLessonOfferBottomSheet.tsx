import React from 'react';
import { BellRing } from 'lucide-react';
import type { InstantLessonOffer } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import { InstantLessonOfferCard } from './InstantLessonOfferCard';

interface InstantLessonOfferBottomSheetProps {
  isOpen: boolean;
  offer: InstantLessonOffer | null;
  secondsLeft?: number;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  isLoading?: 'accept' | 'decline' | null;
}

export const InstantLessonOfferBottomSheet: React.FC<InstantLessonOfferBottomSheetProps> = ({
  isOpen,
  offer,
  secondsLeft,
  onClose,
  onAccept,
  onDecline,
  isLoading = null,
}) => {
  if (!offer) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Nova solicitação de Aula Agora"
      showHeader
      ariaLabel="Nova solicitação de Aula Agora"
    >
      <div className="space-y-3" data-component="instant-lesson-offer-bottom-sheet">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5" role="status" aria-live="polite">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]">
            <BellRing className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[var(--mazzi-dark)]">Você recebeu uma nova aula</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">Confira os detalhes e responda antes que a oferta expire.</p>
          </div>
        </div>

        <InstantLessonOfferCard
          offer={offer}
          secondsLeft={secondsLeft}
          onAccept={onAccept}
          onDecline={onDecline}
          isLoading={isLoading}
        />
      </div>
    </BottomSheet>
  );
};

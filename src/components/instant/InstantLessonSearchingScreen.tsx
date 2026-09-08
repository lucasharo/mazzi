import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface InstantLessonSearchingScreenProps {
  onCancel: () => void;
  isCancelling?: boolean;
}

/** Full-screen state shown while Aula Agora is looking for a professional. */
export const InstantLessonSearchingScreen: React.FC<InstantLessonSearchingScreenProps> = ({ onCancel, isCancelling = false }) => (
  <div className="flex min-h-full flex-1 flex-col bg-[#17181c] px-5 py-6 text-white sm:px-8 sm:py-8" data-component="instant-lesson-searching" role="status" aria-live="polite">
    <main className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="relative mb-8 grid h-28 w-28 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-[var(--mazzi-yellow)]/20 motion-safe:animate-ping" />
        <span className="absolute inset-3 rounded-full border-2 border-[var(--mazzi-yellow)]/45 motion-safe:animate-pulse" />
        <span className="relative grid h-16 w-16 place-items-center rounded-full bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-[0_0_40px_rgba(247,194,54,0.3)] motion-safe:animate-pulse">
          <Search className="h-7 w-7" strokeWidth={2.5} />
        </span>
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Buscando profissionais</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-300">Estamos procurando um profissional disponível perto de você.</p>
    </main>
    <Button
      type="button"
      variant="outline"
      className="min-h-12 w-full border-slate-600 bg-transparent text-white hover:border-slate-400 hover:bg-white/10 active:bg-white/15"
      leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
      onClick={onCancel}
      isLoading={isCancelling}
    >
      Cancelar busca
    </Button>
  </div>
);

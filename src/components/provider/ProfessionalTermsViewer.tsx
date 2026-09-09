import React, { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ModalActionFooter } from '../ui/ModalActionFooter';
import { Badge } from '../ui/Badge';
import { PROFESSIONAL_TERMS_LEGAL_REVIEW_MARKER, type ProfessionalTermsVersion } from '../../domain/professional-terms';

interface ProfessionalTermsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  terms: ProfessionalTermsVersion;
  isAccepted: boolean;
  acceptedAt?: string;
  isAccepting?: boolean;
  onAccept: () => Promise<void>;
}

const formatAcceptedAt = (value?: string) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : undefined;

export const ProfessionalTermsViewer: React.FC<ProfessionalTermsViewerProps> = ({
  isOpen,
  onClose,
  terms,
  isAccepted,
  acceptedAt,
  isAccepting = false,
  onAccept,
}) => {
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const updateReadProgress = () => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const reachedEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    if (reachedEnd) setHasReachedEnd(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    setHasReachedEnd(false);
    const frame = window.requestAnimationFrame(updateReadProgress);
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, terms.version]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Termos do Profissional"
      ariaLabel="Termo de Adesão, Uso e Conduta do Profissional MAZZI"
      size="lg"
      layer="nested"
      portal
      fillContent
      theme="dark"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={updateReadProgress}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-4 pr-1"
        >
          <article className="space-y-5 text-left text-slate-200">
          <header className="relative rounded-2xl border border-[#3a3f4d] bg-[#2d3039] p-4">
          <Badge variant="warning" className="absolute right-4 top-4">Versão {terms.displayVersion}</Badge>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 pr-20">
              <h2 className="text-base font-extrabold leading-tight text-white">{terms.title}</h2>
              <p className="mt-3 text-xs font-medium leading-relaxed text-slate-300">{terms.summary}</p>
            </div>
          </div>
          {isAccepted && acceptedAt && (
            <Badge variant="success" className="mt-3 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-extrabold text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,.12)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Aceito em {formatAcceptedAt(acceptedAt)}
            </Badge>
          )}
          </header>

          {!terms.legalEntityDetailsConfigured && (
            <div role="note" data-legal-review-marker={PROFESSIONAL_TERMS_LEGAL_REVIEW_MARKER} className="flex items-start gap-2 rounded-2xl border border-[#3a3f4d] bg-[#292c34] p-3 text-xs font-medium leading-relaxed text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <span>Dados empresariais definitivos ainda não configurados. Os placeholders são permitidos somente no ambiente de testes.</span>
            </div>
          )}

          <div className="space-y-6">
            {terms.sections.map((section) => (
              <section key={section.id} aria-labelledby={`professional-terms-${section.id}`} className="space-y-2">
                <h3 id={`professional-terms-${section.id}`} className="text-sm font-extrabold text-white">{section.title}</h3>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.id}-paragraph-${index}`} className="text-xs font-medium leading-relaxed text-slate-300">{paragraph}</p>
                ))}
                {section.bullets && (
                  <ul className="list-disc space-y-1 pl-5 text-xs font-medium leading-relaxed text-slate-300">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>
          </article>
        </div>
        <ModalActionFooter align="center" className="!mx-0 !mt-0 !border-[#3a3f4d] !bg-[#20232b] !pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="w-full space-y-3">
            {!isAccepted && (
              <p className="text-center text-[11px] leading-relaxed text-slate-400">
                {hasReachedEnd ? 'Você chegou ao final do termo.' : 'Role até o final do termo para habilitar o aceite.'}
              </p>
            )}
            <Button
              type="button"
              variant="primary"
              className="w-full"
              disabled={isAccepted || !hasReachedEnd || isAccepting}
              isLoading={isAccepting}
              leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}
              onClick={() => onAccept()}
            >
              {isAccepted ? 'Termo aceito' : 'Aceitar e continuar'}
            </Button>
          </div>
        </ModalActionFooter>
      </div>
    </Modal>
  );
};

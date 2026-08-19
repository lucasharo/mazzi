import React from 'react';
import { Car, ChevronRight, Clock, MapPin, ShieldCheck, Star } from 'lucide-react';
import { PublicSearchProviderResult, TransmissionType } from '../../types';
import { formatCentsToBRL } from '../../domain/money';
import { Modal } from '../ui/Modal';
import { Button, PrimaryButton } from '../ui/Button';

export interface ProviderPublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PublicSearchProviderResult | null;
  onSelectSlotToBook?: (providerId: string, date?: string, slot?: any) => void;
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'M'
  );
}

function transmissionLabel(trans?: TransmissionType): string {
  if (trans === 'AUTOMATIC') return 'Automático';
  if (trans === 'MANUAL') return 'Manual';
  return 'Manual / Automático';
}

export const ProviderPublicProfileModal: React.FC<ProviderPublicProfileModalProps> = ({
  isOpen,
  onClose,
  result,
  onSelectSlotToBook,
}) => {
  if (!isOpen || !result) return null;

  const isCFC = result.providerType === 'DRIVING_SCHOOL';
  const location = [result.neighborhood, result.city].filter(Boolean).join(', ') || 'Localização aproximada';
  const offerings = result.publicOfferings || [];
  const availableCategories = Array.from(new Set(offerings.map((o) => o.category).filter(Boolean)));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Perfil do Prestador" size="md">
      <div className="space-y-6 text-left">
        {/* Header / Identity */}
        <section className="text-center" aria-label="Identificação do prestador">
          <div className="relative mx-auto h-20 w-20 sm:h-24 sm:w-24">
            <div className="mazzi-avatar h-full w-full text-xl sm:text-2xl font-bold shadow-sm ring-1 ring-black/5">
              {result.avatarUrl ? (
                <img
                  src={result.avatarUrl}
                  alt={`Foto de ${result.displayName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-dark)]"
                  aria-hidden="true"
                >
                  {getInitials(result.displayName)}
                </span>
              )}
            </div>
            {result.isVerified && (
              <span
                className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-emerald-50 border border-emerald-200/60 p-1 text-emerald-700 shadow-2xs"
                title="Perfil verificado pela plataforma MAZZI"
                aria-label="Prestador verificado"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              </span>
            )}
          </div>

          <div className="mt-3.5 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              {isCFC ? 'Autoescola / CFC' : 'Instrutor autônomo'}
            </p>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-[var(--mazzi-dark)] break-words">
              {result.displayName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
              {result.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[var(--mazzi-dark)] font-bold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>{result.ratingAverage.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">({result.ratingCount} avaliações)</span>
                </span>
              ) : (
                <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">Novo na MAZZI</span>
              )}
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                <span>{location}</span>
              </span>
              {result.formattedDistance && <span className="text-slate-400">· {result.formattedDistance}</span>}
            </div>
          </div>
        </section>

        {/* Key Metrics Hero Block */}
        <section className="mazzi-hero" aria-label="Métricas principais do prestador">
          <div className="p-4 text-center sm:text-left">
            <p className="text-2xl font-bold">
              {result.ratingCount > 0 ? result.ratingAverage.toFixed(1) : 'Novo'}
            </p>
            <p className="mt-1 text-xs font-medium opacity-70">
              {result.ratingCount > 0 ? `${result.ratingCount} avaliações` : 'sem avaliações'}
            </p>
          </div>
          <div className="p-4 text-center sm:text-left">
            <p className="text-2xl font-bold">
              {formatCentsToBRL(result.startingPriceInCents)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/70">
              {offerings.length > 1 ? 'a partir de / aula' : 'por aula prática'}
            </p>
          </div>
        </section>

        {/* Categories & Next Availability Indicator (if exists) */}
        {(availableCategories.length > 0 || result.nextAvailableSlot) && (
          <section className="mazzi-soft-card p-3.5 border border-[var(--mazzi-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-1.5 font-semibold text-[var(--mazzi-dark)]">
                <span className="text-[var(--mazzi-muted)] font-medium">Categorias:</span>
                {availableCategories.map((cat) => (
                  <span key={cat} className="bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-dark)] text-[10px] font-bold uppercase px-2 py-0.5 rounded-md">
                    Cat. {cat}
                  </span>
                ))}
              </div>
            )}
            {result.nextAvailableSlot && (
              <div className="flex items-center gap-1 text-emerald-700 font-semibold ml-auto">
                <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Próximo horário disponível</span>
              </div>
            )}
          </section>
        )}

        {/* Offerings Section */}
        <section aria-label="Aulas e veículos disponíveis">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--mazzi-dark)]">Aulas e Veículos Disponíveis</h3>
            <span className="text-xs font-medium text-slate-400">
              {offerings.length} {offerings.length === 1 ? 'opção' : 'opções'}
            </span>
          </div>
          {offerings.length === 0 ? (
            <div className="mazzi-soft-card p-5 text-center text-xs text-slate-500 border border-[var(--mazzi-border)]">
              Consulte a agenda para visualizar os horários disponíveis deste prestador.
            </div>
          ) : (
            <div className="space-y-2.5">
              {offerings.map((offering) => {
                const trans = transmissionLabel(offering.transmission);
                const details = [
                  trans,
                  offering.category ? `Categoria ${offering.category}` : undefined,
                  offering.durationMinutes ? `${offering.durationMinutes} min` : undefined,
                ].filter(Boolean).join(' · ');

                return (
                  <article key={offering.id} className="mazzi-card p-4 hover:border-slate-300 transition">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-[var(--mazzi-dark)]">
                        <Car className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-[var(--mazzi-dark)]">
                            {offering.vehicleTitle || 'Veículo disponível'}
                          </p>
                          {offering.category && (
                            <span className="shrink-0 text-[10px] font-bold uppercase bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)] border border-[var(--mazzi-border)] px-2 py-0.5 rounded-md">
                              Cat. {offering.category}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-medium text-[var(--mazzi-muted)] truncate">
                          {details}
                        </p>
                        {offering.priceInCents > 0 && (
                          <p className="mt-1.5 text-xs font-bold text-[var(--mazzi-dark)]">
                            {formatCentsToBRL(offering.priceInCents)}
                            {offering.durationMinutes ? (
                              <span className="text-[10px] font-normal text-slate-500"> / {offering.durationMinutes} min</span>
                            ) : null}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* CTA Action */}
        <PrimaryButton
          type="button"
          size="lg"
          className="w-full min-h-[50px] text-sm font-bold shadow-xs"
          onClick={() => {
            onClose();
            onSelectSlotToBook?.(result.providerId);
          }}
          rightIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
          aria-label={`Agendar aula com ${result.displayName}`}
        >
          Agendar aula
        </PrimaryButton>
      </div>
    </Modal>
  );
};

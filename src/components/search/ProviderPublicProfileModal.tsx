// ============================================================================
// MAZZI PLATFORM — PROVIDER PUBLIC PROFILE MODAL
// Detailed public view of an instructor or driving school (CFC).
// Displays public vehicles, ratings, offered categories, and bookable slots preview.
// ============================================================================

import React from 'react';
import {
  ShieldCheck,
  Star,
  MapPin,
  Car,
  Clock,
  Building2,
  User,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { PublicSearchProviderResult } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCentsToBRL } from '../../domain/money';

export interface ProviderPublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PublicSearchProviderResult | null;
  onSelectSlotToBook?: (providerId: string) => void;
}

export const ProviderPublicProfileModal: React.FC<ProviderPublicProfileModalProps> = ({
  isOpen,
  onClose,
  result,
  onSelectSlotToBook,
}) => {
  if (!isOpen || !result) return null;

  const isCFC = result.providerType === 'DRIVING_SCHOOL';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={result.displayName}
      size="md"
    >
      <div className="space-y-4 text-left">
        {/* Header Profile Card */}
        <div className="bg-slate-950 text-white p-4 rounded-2xl flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center shrink-0 border border-slate-800">
            {result.displayName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-900 text-amber-400 border border-slate-800">
                {isCFC ? 'Autoescola / CFC' : 'Instrutor Autônomo'}
              </span>
              {result.isVerified && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Verificado pela Plataforma
                </span>
              )}
            </div>

            <h3 className="font-extrabold text-base text-white mt-1 truncate">{result.displayName}</h3>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="font-bold text-white">{result.ratingAverage.toFixed(1)}</span>
                <span>({result.ratingCount} avaliações)</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{result.neighborhood}, SP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Categories & Transmission Options */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Categorias Atendidas
            </span>
            <div className="flex items-center gap-1">
              {(result.categories || []).map((cat) => (
                <span key={cat} className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-black">
                  Cat. {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Câmbio Disponível
            </span>
            <div className="flex items-center gap-1">
              {(result.transmissions || []).map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-xs font-bold">
                  {t === 'AUTOMATIC' ? 'Automático' : t === 'MANUAL' ? 'Manual' : 'N/A'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Public Offerings List */}
        <div>
          <h4 className="font-extrabold text-sm text-slate-900 mb-2">Aulas e Veículos Disponíveis</h4>
          <div className="space-y-2">
            {(result.publicOfferings || []).map((offering) => (
              <div
                key={offering.id}
                className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900 block">
                      {offering.vehicleTitle}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Aula Prática • {offering.durationMinutes} minutos • Cat. {offering.category}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black text-sm text-slate-950 block">
                    {formatCentsToBRL(offering.priceInCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Available Slot & Action */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-800 block">
              Próxima Disponibilidade
            </span>
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {result.nextAvailableSlot || 'Consulte horários na agenda'}
            </span>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onClose();
              if (onSelectSlotToBook) onSelectSlotToBook(result.providerId);
            }}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Ver Agenda
          </Button>
        </div>
      </div>
    </Modal>
  );
};

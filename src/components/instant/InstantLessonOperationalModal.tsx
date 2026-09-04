import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Compass, MapPin, Navigation, User, X } from 'lucide-react';
import type { Booking } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { UniversalMap } from '../maps/UniversalMap';
import { formatCentsToBRL } from '../../domain/money';
import { formatMeetingPoint } from '../../lib/meeting-point';
import { ExternalNavigationModal } from './ExternalNavigationModal';

interface InstantLessonOperationalModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  isWaitingPayment?: boolean;
  isOnTheWay?: boolean;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  onOpenNavigation?: () => void;
  onSetOnTheWay: (bookingId: string) => Promise<void>;
  isLoading?: boolean;
}

export const InstantLessonOperationalModal: React.FC<InstantLessonOperationalModalProps> = ({
  isOpen,
  onClose,
  booking,
  isWaitingPayment = false,
  isOnTheWay = false,
  distanceKm,
  etaMinutes,
  onOpenNavigation,
  onSetOnTheWay,
  isLoading = false,
}) => {
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const meetingPointText = formatMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint) || booking.fullMeetingPoint || 'Ponto de encontro não informado';
  const latitude = (booking.meetingPoint as any)?.latitude ?? (booking.snapshot?.meetingPoint as any)?.latitude;
  const longitude = (booking.meetingPoint as any)?.longitude ?? (booking.snapshot?.meetingPoint as any)?.longitude;
  const priceFormatted = formatCentsToBRL(booking.totalInCents || booking.priceInCents || 0);
  const studentName = booking.studentName || 'Aluno';
  const category = booking.offering?.category || booking.snapshot?.offeringCategory || 'B';
  const transmission = booking.offering?.transmission || booking.snapshot?.offeringTransmission || 'MANUAL';

  const mapPoint = latitude != null && longitude != null
    ? { lat: latitude, lng: longitude, title: meetingPointText }
    : undefined;

  const handleStartDisplacement = async () => {
    if (submitting || isLoading) return;
    setSubmitting(true);
    try {
      await onSetOnTheWay(booking.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isWaitingPayment ? 'Aula Agora — Aguardando Pagamento' : 'Aula Agora Confirmada'}
        ariaLabel="Detalhes operacionais da Aula Agora"
        size="md"
        useHistory={false}
      >
        <div className="space-y-4" data-component="instant-lesson-operational-modal">
          {isWaitingPayment ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-900">
                  <Clock3 className="h-5 w-5 animate-pulse" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">O aluno está finalizando o pagamento</h3>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    A aula foi aceita. Aguarde a confirmação de pagamento do aluno antes de se deslocar.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                  {isOnTheWay ? <Navigation className="h-5 w-5" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isOnTheWay ? 'Você está a caminho!' : 'Pagamento Confirmado!'}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {isOnTheWay
                      ? 'O aluno já foi avisado e está aguardando você no ponto de encontro.'
                      : 'Sua aula foi confirmada pelo backend. Confira os detalhes e dirija-se ao ponto de encontro.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cards de detalhes da aula */}
          <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs space-y-3 text-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <User className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-500">Aluno</p>
                  <p className="text-sm font-extrabold text-slate-900">{studentName}</p>
                </div>
              </div>
              <strong className="text-base font-extrabold text-slate-900">{priceFormatted}</strong>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl bg-slate-50 p-2.5">
                <span className="block font-bold text-slate-400">Categoria</span>
                <span className="font-extrabold text-slate-800">Cat. {category} • {transmission}</span>
              </div>
              <div className="rounded-2xl bg-slate-50 p-2.5">
                <span className="block font-bold text-slate-400">Estimativa</span>
                <span className="font-extrabold text-slate-800">
                  {distanceKm != null && etaMinutes != null
                    ? `${distanceKm} km • ~${etaMinutes} min (geodésico)`
                    : 'Chegada em até 30 min'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-500">
                <MapPin className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
                Ponto de encontro exato
              </span>
              <p className="mt-1 font-extrabold text-slate-900 break-words">{meetingPointText}</p>
            </div>
          </div>

          {/* Mapa do ponto de encontro */}
          {mapPoint && (
            <div className="overflow-hidden rounded-2xl border border-[var(--mazzi-border)]">
              <UniversalMap
                providers={[]}
                meetingPoint={mapPoint}
                height="180px"
                zoom={16}
                interactive={false}
              />
            </div>
          )}

          {/* Ações da aula */}
          <div className="space-y-2 pt-1">
            {!isWaitingPayment && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-bold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
                  disabled={isLoading || submitting}
                  onClick={() => {
                    if (onOpenNavigation) onOpenNavigation();
                    setNavModalOpen(true);
                  }}
                  leftIcon={<Compass className="h-4 w-4 text-amber-600" aria-hidden="true" />}
                >
                  Abrir navegação
                </Button>

                {!isOnTheWay ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full font-extrabold"
                    isLoading={submitting || isLoading}
                    onClick={() => void handleStartDisplacement()}
                    leftIcon={<Navigation className="h-4 w-4" aria-hidden="true" />}
                  >
                    Estou a caminho
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full font-extrabold cursor-default opacity-90"
                    disabled
                    leftIcon={<CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
                  >
                    A caminho do aluno
                  </Button>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full text-slate-600"
              onClick={onClose}
              leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
            >
              Voltar para Gestão
            </Button>
          </div>
        </div>
      </Modal>

      {latitude != null && longitude != null && (
        <ExternalNavigationModal
          isOpen={navModalOpen}
          onClose={() => setNavModalOpen(false)}
          target={{ latitude, longitude, label: meetingPointText }}
        />
      )}
    </>
  );
};

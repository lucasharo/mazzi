import React from 'react';
import {
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  CreditCard,
  MapPin,
  AlertTriangle,
  XCircle,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { Booking } from '../../types';
import { Button, ButtonBase } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { StatusBadge } from '../ui/StatusBadge';
import { CountdownTimer } from '../ui/CountdownTimer';
import { UniversalMap } from '../maps/UniversalMap';
import { CheckInAvailability } from '../../domain/checkin';
import { formatTimeBR } from '../../lib/date-format';
import { ProfileAvatar } from '../profile/ProfileAvatar';
import { PROVIDER_CANCELLATION_REASONS } from '../../domain/cancellation';

export type BookingDetailsAudience = 'student' | 'provider';

export function getBookingRefundAmountInCents(booking: Booking): number {
  const persistedRefund = booking.refundAmountInCents ?? booking.cancellationData?.refund_amount_in_cents;
  const amount = Number(persistedRefund ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function normalizeDomainToken(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function removeDomainCodes(value: string): string {
  const knownCodes = [
    ...PROVIDER_CANCELLATION_REASONS.map((item) => item.code),
    'PLATFORM_FAILURE',
    'PROVIDER_PERSONAL_EMERGENCY',
  ];
  let cleaned = value;
  for (const code of knownCodes) {
    const codePattern = code.replace(/_/g, '[_\\s-]+');
    cleaned = cleaned.replace(new RegExp(`(?:^|[\\s:()[\\]-])${codePattern}(?=$|[\\s:()[\\]-])`, 'ig'), ' ');
  }
  return cleaned
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, ' ')
    .replace(/\s*[:\-–]\s*(?=$|[.])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFriendlyCancellationReason(booking: Booking): string | null {
  const reason = booking.cancellationReason?.trim();
  if (!reason) return null;

  if (reason === 'STUDENT_REQUEST' || reason === 'Cancelamento Aula Agora') {
    return booking.status === 'CANCELLED_BY_STUDENT'
      ? 'Cancelamento solicitado pelo aluno, sem motivo informado.'
      : 'Cancelamento solicitado pelo profissional, sem motivo informado.';
  }

  const separatorIndex = reason.indexOf(':');
  const rawCode = (separatorIndex >= 0 ? reason.slice(0, separatorIndex) : reason).trim().toUpperCase();
  const detail = separatorIndex >= 0 ? reason.slice(separatorIndex + 1).trim() : '';
  const providerReason = PROVIDER_CANCELLATION_REASONS.find((item) => item.code === rawCode);
  const internalReasonLabels: Record<string, string> = {
    PLATFORM_FAILURE: 'Falha operacional da plataforma',
    PROVIDER_PERSONAL_EMERGENCY: 'Emergência pessoal do profissional',
  };
  const label = providerReason?.label || internalReasonLabels[rawCode];
  if (label) {
    const sanitizedDetail = removeDomainCodes(detail);
    return sanitizedDetail ? `${label}: ${sanitizedDetail}` : label;
  }

  // Older records may contain a human label followed by the raw code, for
  // example: "Conflito de agenda: SCHEDULE CONFLICT". Remove the code before
  // presenting the message so domain tokens never reach the user interface.
  const embeddedProviderReason = PROVIDER_CANCELLATION_REASONS.find((item) => normalizeDomainToken(reason).includes(item.code));
  if (embeddedProviderReason) {
    const humanText = removeDomainCodes(reason);
    const humanLabel = normalizeDomainToken(embeddedProviderReason.label);
    return humanText && normalizeDomainToken(humanText) !== humanLabel
      ? `${embeddedProviderReason.label}: ${humanText}`
      : embeddedProviderReason.label;
  }

  // Never leak an unknown enum/domain token into an end-user surface.
  const sanitizedReason = removeDomainCodes(reason);
  if (!sanitizedReason || /^[A-Z][A-Z0-9_\s-]+$/.test(sanitizedReason)) return 'Motivo não informado.';

  return sanitizedReason;
}

interface BookingDetailsHeaderProps {
  status: Booking['status'];
  audience: BookingDetailsAudience;
  title: string;
  subtitle?: React.ReactNode;
  instructorCheckedIn?: boolean;
  avatarUrl?: string;
}

export const BookingDetailsHeader: React.FC<BookingDetailsHeaderProps> = ({
  status,
  audience,
  title,
  subtitle,
  instructorCheckedIn,
  avatarUrl,
}) => (
  <div className="mazzi-compact-card flex items-start justify-between gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
    <div className="flex min-w-0 items-start gap-3">
      {avatarUrl && <ProfileAvatar name={title} imageUrl={avatarUrl} size="md" className="h-11 w-11" />}
      <div className="min-w-0">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">Detalhes da aula</p>
      <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--mazzi-dark)]">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] font-medium text-slate-500">{subtitle}</p>}
      </div>
    </div>
    <StatusBadge className="mt-0.5" status={status} audience={audience === 'student' ? 'student' : undefined} instructorCheckedIn={instructorCheckedIn} />
  </div>
);

interface BookingPresenceCardProps {
  audience: BookingDetailsAudience;
  booking: Booking;
  visible: boolean;
  checkInAvailability: CheckInAvailability;
  canCheckInAtLocation?: boolean;
  checkInError?: string | null;
  isCheckingIn?: boolean;
  onCheckIn?: () => void | Promise<void>;
  showCheckInAction?: boolean;
  studentCheckInUnlocked?: boolean;
}

export const BookingPresenceCard: React.FC<BookingPresenceCardProps> = ({
  audience,
  booking,
  visible,
  checkInAvailability,
  canCheckInAtLocation = true,
  checkInError,
  isCheckingIn = false,
  onCheckIn,
  showCheckInAction = true,
  studentCheckInUnlocked = true,
}) => {
  if (!visible) return null;

  const studentCheckedIn = Boolean(booking.studentCheckedIn);
  const instructorCheckedIn = Boolean(booking.instructorCheckedIn || booking.checkinInstructorAt);
  const selfCheckedIn = audience === 'student' ? studentCheckedIn : instructorCheckedIn;
  const checkInUnlocked = checkInAvailability.canCheckIn
    && (audience !== 'provider' || canCheckInAtLocation)
    && (audience !== 'student' || studentCheckInUnlocked);
  const checkInAction = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      isLoading={isCheckingIn}
      disabled={isCheckingIn || !onCheckIn || !checkInUnlocked}
      onClick={() => void onCheckIn?.()}
      leftIcon={<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />}
      aria-label={audience === 'student' && !instructorCheckedIn ? 'Aguardando check-in do PRO' : 'Fazer check-in na aula'}
    >
      {checkInUnlocked ? 'Fazer check-in' : audience === 'student' && !instructorCheckedIn ? 'Aguardando check-in do PRO' : audience === 'provider' && !canCheckInAtLocation ? 'Realizar check-in' : 'Check-in em breve'}
    </Button>
  );

  return (
    <div className="mazzi-compact-card space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
      <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500">
        <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Status de presença na aula
      </h4>

      <PresenceRow
        label={audience === 'student' ? 'Seu check-in' : 'Check-in do aluno'}
        description={studentCheckedIn ? 'Presença confirmada no ponto de encontro' : 'Aguardando check-in do aluno'}
        checked={studentCheckedIn}
        checkedAt={booking.checkinStudentAt}
        statusText="Aguardando check-in"
        action={audience === 'student' && showCheckInAction ? checkInAction : undefined}
      />

      <PresenceRow
        label={audience === 'student' ? 'Check-in do instrutor' : 'Seu check-in'}
        description={instructorCheckedIn ? 'Presença confirmada no ponto de encontro' : audience === 'provider' ? 'Aguardando seu check-in' : 'Aguardando check-in do profissional'}
        checked={instructorCheckedIn}
        checkedAt={booking.checkinInstructorAt}
        statusText="Aguardando check-in"
        action={audience === 'provider' && showCheckInAction ? checkInAction : undefined}
      />

      {checkInError && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span>{checkInError}</span>
        </div>
      )}
      {!selfCheckedIn && !checkInAvailability.canCheckIn && checkInAvailability.opensAt && (
        <p className="border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-500">
          Aguardando abertura do check-in · disponível a partir de {formatTimeBR(checkInAvailability.opensAt)}
        </p>
      )}
    </div>
  );
};

interface PresenceRowProps {
  label: string;
  description: string;
  checked: boolean;
  checkedAt?: string;
  statusText?: string;
  action?: React.ReactNode;
}

const PresenceRow: React.FC<PresenceRowProps> = ({ label, description, checked, checkedAt, statusText, action }) => (
  <div className="flex items-center justify-between gap-2 [&+&]:border-t [&+&]:border-slate-100 [&+&]:pt-3">
    <div className="min-w-0">
      <span className="block text-xs font-bold text-slate-800">{label}</span>
      <span className="block text-[11px] text-slate-500">{description}</span>
    </div>
    {checked ? (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Realizado {checkedAt ? `às ${formatTimeBR(checkedAt)}` : ''}
      </span>
    ) : action || (
      <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{statusText || 'Aguardando'}</span>
    )}
  </div>
);

interface BookingDetailsOverviewProps {
  providerLabel: string;
  providerName: string;
  instructorName: string;
  vehicleName: string;
  category: string;
  transmission: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel?: string;
  meetingPoint?: string;
  meetingPointNotice?: string;
  isProviderAddress?: boolean;
  showCopyAddress?: boolean;
  addressCopied?: boolean;
  onCopyAddress?: () => void | Promise<void>;
}

export const BookingDetailsOverview: React.FC<BookingDetailsOverviewProps> = ({
  providerLabel,
  providerName,
  instructorName,
  vehicleName,
  category,
  transmission,
  dateLabel,
  timeLabel,
  durationLabel,
  meetingPoint,
  meetingPointNotice,
  isProviderAddress = false,
  showCopyAddress = false,
  addressCopied = false,
  onCopyAddress,
}) => (
  <div className="mazzi-compact-card space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Detalhes da aula</h4>
    <div className="grid grid-cols-1 gap-2 border-b border-slate-100 pb-3 text-xs sm:grid-cols-2">
      <div className="flex items-center gap-2 font-extrabold text-[var(--mazzi-dark)]">
        <Calendar className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        <span>Data: {dateLabel}</span>
      </div>
      <div className="flex items-center gap-2 font-semibold text-slate-700">
        <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span>{timeLabel}{durationLabel ? ` · ${durationLabel}` : ''}</span>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
      <DetailPerson icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />} label={providerLabel} value={providerName} />
      <DetailPerson icon={<UserRound className="h-3.5 w-3.5" aria-hidden="true" />} label="Instrutor" value={instructorName} />
      <DetailPerson icon={<Car className="h-3.5 w-3.5" aria-hidden="true" />} label="Veículo" value={vehicleName} />
      <div className="space-y-1">
        <span className="block text-[11px] font-medium text-slate-400">Categoria / Câmbio</span>
        <span className="font-bold text-[var(--mazzi-dark)]">Cat. {category} · {transmission}</span>
      </div>
    </div>
    {(meetingPoint || meetingPointNotice) && (
      <div className="space-y-3 border-t border-slate-100 pt-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mazzi-muted)]">Endereço da aula</span>
            {meetingPointNotice ? (
              <p className="mt-1 break-words text-xs font-bold leading-5 text-amber-800" role="status">{meetingPointNotice}</p>
            ) : (
              <p className="mt-1 break-words text-xs font-extrabold text-[var(--mazzi-dark)]">{meetingPoint}</p>
            )}
          </div>
          {showCopyAddress && onCopyAddress && (
            <IconButton
              label={addressCopied ? 'Endereço copiado' : 'Copiar endereço'}
              onClick={() => void onCopyAddress()}
              className="shrink-0 rounded-2xl bg-[var(--mazzi-surface-soft)] text-slate-600 hover:bg-slate-200"
            >
              {addressCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
          )}
        </div>
      </div>
    )}
  </div>
);

const DetailPerson: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="space-y-1">
    <span className="block text-[11px] font-medium text-slate-400">{label}</span>
    <div className="flex items-center gap-1.5 font-bold text-[var(--mazzi-dark)]">
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className="truncate">{value || 'Não informado'}</span>
    </div>
  </div>
);

interface BookingMapPreviewProps {
  latitude: number;
  longitude: number;
  title: string;
  showMarker?: boolean;
  showNavigation?: boolean;
  onOpenNavigation?: () => void;
}

export const BookingMapPreview: React.FC<BookingMapPreviewProps> = ({ latitude, longitude, title, showMarker = true, showNavigation = false, onOpenNavigation }) => (
  <div className="relative overflow-hidden rounded-2xl border border-[var(--mazzi-border)] shadow-xs">
    {!showMarker && <p className="sr-only">Mapa da região da aula, sem marcador do endereço exato.</p>}
    <UniversalMap
      providers={[]}
      mapCenter={{ lat: latitude, lng: longitude }}
      meetingPoint={showMarker ? { lat: latitude, lng: longitude, title } : undefined}
      height="180px"
      zoom={showMarker ? 16 : 15}
      showMeetingPointPopup={false}
      interactive={false}
    />
    {showNavigation && onOpenNavigation && (
      <ButtonBase
        type="button"
        onClick={onOpenNavigation}
        aria-label="Abrir navegação"
        className="absolute inset-x-0 bottom-0 z-[1000] flex items-end justify-center pb-3 focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-[var(--mazzi-dark)] px-3.5 py-2 text-xs font-bold text-white shadow-md">
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Abrir navegação
        </span>
      </ButtonBase>
    )}
  </div>
);

interface BookingPaymentSummaryProps {
  items: Array<{ label: string; amount: string }>;
  total: string;
  totalLabel?: string;
}

export const BookingPaymentSummary: React.FC<BookingPaymentSummaryProps> = ({ items, total, totalLabel = 'Total da aula' }) => (
  <div className="mazzi-compact-card space-y-2 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--mazzi-dark)]">
      <CreditCard className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
      Resumo do pagamento
    </h4>
    {items.map((item) => (
      <div key={item.label} className="flex items-center justify-between text-xs text-slate-700">
        <span>{item.label}</span>
        <span className="font-bold">{item.amount}</span>
      </div>
    ))}
    <div className="flex items-center justify-between border-t border-[var(--mazzi-border)] pt-2 text-sm font-bold text-[var(--mazzi-dark)]">
      <span>{totalLabel}</span>
      <span>{total}</span>
    </div>
  </div>
);

interface BookingCancellationNoticeProps {
  booking: Booking;
}

export const BookingCancellationNotice: React.FC<BookingCancellationNoticeProps> = ({ booking }) => {
  const isCancelled = booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER';
  if (!isCancelled) return null;
  const friendlyReason = getFriendlyCancellationReason(booking);

  return (
    <div role="status" className="mazzi-compact-card space-y-1 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
      <div className="flex items-center gap-1.5 font-extrabold">
        <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
        <span>{booking.status === 'CANCELLED_BY_STUDENT' ? 'Cancelada pelo aluno' : 'Cancelada pelo profissional'}</span>
      </div>
      {friendlyReason && <p className="pl-5 text-[11px] font-medium text-rose-700">Motivo: {friendlyReason}</p>}
    </div>
  );
};

interface BookingPaymentStateNoticesProps {
  isPendingPayment: boolean;
  isHoldValid: boolean;
  secondsLeft: number | null;
  isExpired: boolean;
  showCountdown?: boolean;
}

export const BookingPaymentStateNotices: React.FC<BookingPaymentStateNoticesProps> = ({
  isPendingPayment,
  isHoldValid,
  secondsLeft,
  isExpired,
  showCountdown = true,
}) => (
  <>
    {showCountdown && isPendingPayment && isHoldValid && secondsLeft !== null && (
      <CountdownTimer secondsRemaining={secondsLeft} />
    )}
    {isPendingPayment && isHoldValid && secondsLeft === null && (
      <div role="status" className="mazzi-compact-card flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span>Aguardando confirmação do pagamento. Horário retido temporariamente.</span>
      </div>
    )}
    {isExpired && (
      <div role="status" className="mazzi-compact-card flex items-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 p-3.5 text-xs font-medium text-slate-700">
        <AlertTriangle className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>Pagamento não realizado. O prazo para confirmar este horário terminou. Por favor, faça um novo agendamento.</span>
      </div>
    )}
  </>
);

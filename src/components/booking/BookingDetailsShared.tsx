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
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { StatusBadge } from '../ui/StatusBadge';
import { UniversalMap } from '../maps/UniversalMap';
import { CheckInAvailability } from '../../domain/checkin';
import { formatTimeBR } from '../../lib/date-format';

export type BookingDetailsAudience = 'student' | 'provider';

interface BookingDetailsHeaderProps {
  status: Booking['status'];
  audience: BookingDetailsAudience;
  title: string;
  subtitle?: React.ReactNode;
  instructorCheckedIn?: boolean;
}

export const BookingDetailsHeader: React.FC<BookingDetailsHeaderProps> = ({
  status,
  audience,
  title,
  subtitle,
  instructorCheckedIn,
}) => (
  <div className="mazzi-compact-card flex items-start justify-between gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
    <div className="min-w-0">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--mazzi-muted)]">Detalhes da aula</p>
      <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--mazzi-dark)]">{title}</p>
      {subtitle && <p className="mt-1 text-[11px] font-medium text-slate-500">{subtitle}</p>}
    </div>
    <StatusBadge className="mt-0.5" status={status} audience={audience === 'student' ? 'student' : undefined} instructorCheckedIn={instructorCheckedIn} />
  </div>
);

interface BookingPresenceCardProps {
  audience: BookingDetailsAudience;
  booking: Booking;
  visible: boolean;
  checkInAvailability: CheckInAvailability;
  checkInError?: string | null;
  isCheckingIn?: boolean;
  onCheckIn?: () => void | Promise<void>;
}

export const BookingPresenceCard: React.FC<BookingPresenceCardProps> = ({
  audience,
  booking,
  visible,
  checkInAvailability,
  checkInError,
  isCheckingIn = false,
  onCheckIn,
}) => {
  if (!visible) return null;

  const studentCheckedIn = Boolean(booking.studentCheckedIn);
  const instructorCheckedIn = Boolean(booking.instructorCheckedIn);
  const selfCheckedIn = audience === 'student' ? studentCheckedIn : instructorCheckedIn;
  const checkInAction = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      isLoading={isCheckingIn}
      disabled={isCheckingIn || !onCheckIn || !checkInAvailability.canCheckIn}
      onClick={() => void onCheckIn?.()}
      leftIcon={<UserCheck className="h-3.5 w-3.5" aria-hidden="true" />}
      aria-label="Fazer check-in na aula"
    >
      {checkInAvailability.canCheckIn ? 'Fazer check-in' : 'Check-in em breve'}
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
        statusText="Aguardando"
        action={audience === 'student' ? checkInAction : undefined}
      />

      <PresenceRow
        label={audience === 'student' ? 'Check-in do instrutor' : 'Seu check-in'}
        description={instructorCheckedIn ? 'Presença confirmada no ponto de encontro' : audience === 'provider' ? 'Aguardando seu check-in' : 'Aguardando check-in do profissional'}
        checked={instructorCheckedIn}
        checkedAt={booking.checkinInstructorAt}
        statusText="Aguardando check-in"
        action={audience === 'provider' ? checkInAction : undefined}
      />

      {checkInError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
          <span aria-hidden="true">!</span>
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
  isProviderAddress?: boolean;
  showCopyAddress?: boolean;
  addressCopied?: boolean;
  onCopyAddress?: () => void | Promise<void>;
  hasExactMeetingPoint?: boolean;
  showNavigation?: boolean;
  onOpenNavigation?: () => void;
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
  isProviderAddress = false,
  showCopyAddress = false,
  addressCopied = false,
  onCopyAddress,
  hasExactMeetingPoint = false,
  showNavigation = true,
  onOpenNavigation,
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
    {meetingPoint && (
      <div className="space-y-3 border-t border-slate-100 pt-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--mazzi-muted)]">Endereço da aula</span>
            <p className="mt-1 break-words text-xs font-extrabold text-[var(--mazzi-dark)]">{meetingPoint}</p>
          </div>
          {showCopyAddress && onCopyAddress && (
            <IconButton
              label={addressCopied ? 'Endereço copiado' : 'Copiar endereço'}
              onClick={() => void onCopyAddress()}
              className="shrink-0 rounded-xl bg-[var(--mazzi-surface-soft)] text-slate-600 hover:bg-slate-200"
            >
              {addressCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
          )}
        </div>
        {showNavigation && (
          hasExactMeetingPoint && onOpenNavigation ? (
            <Button type="button" variant="secondary" className="w-full rounded-2xl font-bold text-xs" onClick={onOpenNavigation} leftIcon={<Compass className="h-4 w-4" aria-hidden="true" />}>
              Abrir navegação
            </Button>
          ) : (
            <p className="text-xs font-semibold text-amber-800" role="status">Não foi possível obter a localização exata do ponto de encontro.</p>
          )
        )}
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
}

export const BookingMapPreview: React.FC<BookingMapPreviewProps> = ({ latitude, longitude, title }) => (
  <div className="overflow-hidden rounded-2xl border border-[var(--mazzi-border)] shadow-xs">
    <UniversalMap
      providers={[]}
      meetingPoint={{ lat: latitude, lng: longitude, title }}
      height="180px"
      zoom={16}
      showMeetingPointPopup={false}
      interactive={false}
    />
  </div>
);

interface BookingPaymentSummaryProps {
  items: Array<{ label: string; amount: string }>;
  total: string;
}

export const BookingPaymentSummary: React.FC<BookingPaymentSummaryProps> = ({ items, total }) => (
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
      <span>Total da aula</span>
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

  return (
    <div role="status" className="mazzi-compact-card space-y-1 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
      <div className="flex items-center gap-1.5 font-extrabold">
        <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
        <span>{booking.status === 'CANCELLED_BY_STUDENT' ? 'Cancelada pelo aluno' : 'Cancelada pelo profissional'}</span>
      </div>
      {booking.cancellationReason && <p className="pl-5 text-[11px] font-medium text-rose-700">Motivo: {booking.cancellationReason}</p>}
    </div>
  );
};

interface BookingPaymentStateNoticesProps {
  isPendingPayment: boolean;
  isHoldValid: boolean;
  minutesLeft: number | null;
  isExpired: boolean;
}

export const BookingPaymentStateNotices: React.FC<BookingPaymentStateNoticesProps> = ({
  isPendingPayment,
  isHoldValid,
  minutesLeft,
  isExpired,
}) => (
  <>
    {isPendingPayment && isHoldValid && (
      <div role="status" className="mazzi-compact-card flex items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>Aguardando confirmação do pagamento. Horário retido temporariamente.</span>
        </div>
        {minutesLeft !== null && <span className="shrink-0 rounded-md bg-amber-200/80 px-2 py-0.5 text-[11px] font-extrabold text-amber-950">{minutesLeft} min</span>}
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

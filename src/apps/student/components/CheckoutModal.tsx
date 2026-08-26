import React, { useState, useEffect } from 'react';
import { ShieldCheck, CreditCard, QrCode, Clock, AlertCircle, CheckCircle2, XCircle, Copy, Check, Building2, Car, UserCheck, Calendar, Lock, Sparkles, ArrowLeft, KeyRound, MapPin, AlertTriangle, } from 'lucide-react';
import {
  Provider, Vehicle, ServiceOffering, Quote, Booking, Payment, PaymentMethodType, } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { formatCentsToBRL } from '../../../domain/money';
import { isQuoteExpired, QuoteDomainError } from '../../../domain/quote';
import { createBookingHold, BookingDomainError } from '../../../domain/booking';
import { PaymentService } from '../../../domain/payments/payment-service';
import { FakePaymentGateway } from '../../../domain/payments/fake-adapter';
import { useAuth } from '../../../components/auth/AuthContext';
import { supabase } from '../../../lib/supabase';
import { dbService } from '../../../lib/db-service';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { formatDateBR, formatTimeBR } from '../../../lib/date-format';
import { geocodeAddress } from '../../../lib/geocoding';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  vehicle: Vehicle | null;
  offering: ServiceOffering | null;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  scheduledStartAt?: string; // ISO String
  onGoToBookings?: () => void;
  onChooseAnotherSlot?: () => void;
  existingBookings?: Booking[];
  onBookingConfirmed: (booking: Booking) => void;
  resumeBooking?: Booking | null;
}

type CheckoutStep =
  | 'QUOTE_PREVIEW'
  | 'AUTH_REQUIRED'
  | 'PAYMENT_SELECTION'
  | 'SUCCESS'
  | 'ERROR_SLOT_UNAVAILABLE'
  | 'ERROR_QUOTE_EXPIRED';

function friendlyCheckoutError(error: unknown, fallback: string): string {
  const value = error as { code?: string; message?: string } | null;
  const technicalMessage = `${value?.code || ''} ${value?.message || ''}`.toUpperCase();

  if (technicalMessage.includes('STUDENT_ADDRESS_OUTSIDE_PROVIDER_RADIUS')) {
    return 'O endereço informado está fora do raio de atendimento deste instrutor ou autoescola. Escolha outro endereço ou use o endereço do instrutor/autoescola como ponto de encontro.';
  }
  if (technicalMessage.includes('STUDENT_ADDRESS_COORDINATES_REQUIRED')) {
    return 'Não conseguimos localizar esse endereço. Confira os dados informados e tente novamente.';
  }
  if (technicalMessage.includes('ADDRESS_NOT_FOUND')) {
    return 'Não encontramos esse endereço. Confira os dados informados e tente novamente.';
  }
  if (technicalMessage.includes('GEOCODING_UNAVAILABLE')) {
    return 'Não foi possível localizar o endereço agora. Tente novamente em instantes.';
  }
  if (technicalMessage.includes('STUDENT_ADDRESS_REQUIRED')) {
    return 'Informe o endereço do aluno para calcular a distância.';
  }
  if (technicalMessage.includes('MEETING_POINT_TYPE_INVALID')) {
    return 'Selecione um ponto de encontro válido.';
  }
  if (technicalMessage.includes('STUDENT_ALREADY_BOOKED_FOR_SLOT') || technicalMessage.includes('EXCLUDE_STUDENT_OVERLAPPING_BOOKINGS')) {
    return 'Você já possui uma aula agendada nesse horário.';
  }
  if (technicalMessage.includes('PAYMENT_UUID_GENERATION_FAILED')) {
    return 'Não foi possível obter um ID de pagamento válido para esta reserva. Tente novamente em instantes.';
  }
  if (technicalMessage.includes('CROSS_STUDENT_BOOKING_ACCESS_DENIED')) {
    return 'Você não possui autorização para este agendamento.';
  }
  if (technicalMessage.includes('BOOKING_NOT_PENDING_PAYMENT') || technicalMessage.includes('BOOKING_ALREADY_PAID')) {
    return 'Esta reserva já foi paga ou não está pendente de pagamento.';
  }
  if (technicalMessage.includes('SELECTED_SLOT_NOT_AVAILABLE') || technicalMessage.includes('SLOT_NO_LONGER_AVAILABLE')) {
    return 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.';
  }

  return fallback;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  provider,
  vehicle,
  offering,
  scheduledDate,
  startTime,
  endTime,
  scheduledStartAt,
  onGoToBookings,
  onChooseAnotherSlot,
  existingBookings = [],
  onBookingConfirmed,
  resumeBooking,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [step, setStep] = useState<CheckoutStep>('QUOTE_PREVIEW');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentAttemptId, setPaymentAttemptId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('PIX');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [meetingPointType, setMeetingPointType] = useState<'PROVIDER' | 'STUDENT'>('PROVIDER');
  const [studentAddress, setStudentAddress] = useState('');

  // Time remaining counters
  const [quoteTimeRemainingSec, setQuoteTimeRemainingSec] = useState<number>(600);
  const [holdTimeRemainingSec, setHoldTimeRemainingSec] = useState<number>(600);

  // Initialize Payment Service with Fake Gateway
  const paymentService = React.useMemo(() => {
    return new PaymentService(new FakePaymentGateway());
  }, []);

  const createQuoteInFlightRef = React.useRef(false);
  const checkoutAttemptIdRef = React.useRef<string>('');

  // Reset and generate quote when modal opens or params change
  useEffect(() => {
    let active = true;

    setQuote(null);
    setErrorMessage(null);
    setBooking(null);
    setPayment(null);
    setStep('QUOTE_PREVIEW');

    if (!isOpen) {
      checkoutAttemptIdRef.current = '';
      return;
    }

    if (resumeBooking) {
      setBooking(resumeBooking);

      const fetchOrCreateRealPayment = async () => {
        try {
          const isRealDb = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');
          let realPayId: string | undefined;

          if (isRealDb) {
            const payRes = await dbService.createBookingPayment(
              resumeBooking.id,
              paymentMethod || 'PIX',
              `idem_pay_${resumeBooking.id}`
            );
            if (payRes && (payRes.payment_id || payRes.id)) {
              realPayId = payRes.payment_id || payRes.id;
            } else {
              throw new Error('PAYMENT_UUID_GENERATION_FAILED');
            }
          } else {
            realPayId = `pay_${resumeBooking.id}`;
          }

          if (!realPayId) {
            throw new Error('PAYMENT_UUID_GENERATION_FAILED');
          }

          const initialPay: Payment = {
            id: realPayId,
            bookingId: resumeBooking.id,
            studentId: user?.id || resumeBooking.studentId,
            providerId: resumeBooking.providerId,
            gateway: 'DEVELOPMENT_MOCK',
            idempotencyKey: `idem_pay_${resumeBooking.id}`,
            method: paymentMethod || 'PIX',
            status: 'PENDING',
            amountInCents: resumeBooking.totalInCents || resumeBooking.snapshot?.totalInCents || 0,
            platformFeeInCents: resumeBooking.platformFeeInCents || resumeBooking.snapshot?.platformFeeInCents || 0,
            providerAmountInCents: (resumeBooking.totalInCents || 0) - (resumeBooking.platformFeeInCents || 0),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          if (active) {
            setPayment(initialPay);
            setStep('PAYMENT_SELECTION');
          }
        } catch (err: any) {
          if (!active) return;
          if (err?.message?.includes('BOOKING_HOLD_EXPIRED') || err?.message?.includes('EXPIRED')) {
            setErrorMessage('Tempo para pagamento expirado. O agendamento foi cancelado.');
            setStep('ERROR_QUOTE_EXPIRED');
          } else {
            setErrorMessage(friendlyCheckoutError(err, 'Não foi possível carregar o pagamento pendente.'));
          }
        }
      };

      fetchOrCreateRealPayment();
      return;
    }

    if (!checkoutAttemptIdRef.current) {
      checkoutAttemptIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    if (!provider || !vehicle || !offering) {
      return;
    }

    if (!scheduledStartAt || !scheduledDate || !startTime || !endTime) {
      setErrorMessage('Escolha um horário disponível antes de continuar.');
      return;
    }

    const initializeQuote = async () => {
      if (!user?.id) {
        setStep('AUTH_REQUIRED');
        return;
      }

      if (createQuoteInFlightRef.current) return;
      createQuoteInFlightRef.current = true;

      try {
        const finalScheduledStartAt = scheduledStartAt;
        let idempotencyKey = `idem_quote_${offering.id}_${finalScheduledStartAt}_${checkoutAttemptIdRef.current}`;

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offering.id);

        if (isUuid) {
          try {
            let rpcRes;
            try {
              rpcRes = await dbService.createQuoteFromOffering(
                offering.id,
                finalScheduledStartAt,
                idempotencyKey
              );
            } catch (firstErr: any) {
              const errStr = String(firstErr?.message || '');
              if (errStr.includes('QUOTE_IDEMPOTENCY_KEY_STALE') || errStr.includes('STALE') || errStr.includes('23505')) {
                // Historical key was stale -> generate fresh attempt key and retry once
                checkoutAttemptIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                idempotencyKey = `idem_quote_${offering.id}_${finalScheduledStartAt}_${checkoutAttemptIdRef.current}`;
                rpcRes = await dbService.createQuoteFromOffering(
                  offering.id,
                  finalScheduledStartAt,
                  idempotencyKey
                );
              } else {
                throw firstErr;
              }
            }

            if (!active) return;

            const persistedQuote: Quote = {
              id: rpcRes.quote_id,
              studentId: rpcRes.student_id,
              providerId: rpcRes.provider_id,
              providerName: provider.name,
              instructorId: rpcRes.instructor_id,
              instructorName: offering.instructorName || provider.name,
              vehicleId: rpcRes.vehicle_id,
              vehicleName: `${vehicle.brand} ${vehicle.model}`,
              offeringId: rpcRes.offering_id,
              category: offering.category,
              transmission: offering.transmission,
              durationMinutes: offering.durationMinutes,
              scheduledDate,
              startTime,
              endTime,
              scheduledStartAt: rpcRes.scheduled_start_at,
              scheduledEndAt: rpcRes.scheduled_end_at,
              priceInCents: rpcRes.price_in_cents,
              platformFeeInCents: rpcRes.platform_fee_in_cents,
              totalInCents: rpcRes.total_in_cents,
              expiresAt: rpcRes.expires_at,
              status: rpcRes.status || 'ACTIVE',
              createdAt: new Date().toISOString(),
              idempotencyKey,
            };

            setQuote(persistedQuote);
            const remaining = Math.max(0, Math.floor((new Date(persistedQuote.expiresAt).getTime() - Date.now()) / 1000));
            setQuoteTimeRemainingSec(remaining);
            return;
          } catch (dbErr: any) {
            if (!active) return;
            console.error('QUOTE_CREATE_FAILED on real Database:', dbErr);
            if (dbErr?.message?.includes('SELECTED_SLOT_NOT_AVAILABLE')) {
              setStep('ERROR_SLOT_UNAVAILABLE');
            } else {
              setErrorMessage(friendlyCheckoutError(dbErr, 'Não foi possível criar a cotação. Tente novamente.'));
            }
            return;
          } finally {
            if (active) {
              createQuoteInFlightRef.current = false;
            }
          }
        }

        throw new Error('QUOTE_CREATE_FAILED: Oferta inválida para cotação no Supabase.');
      } catch (err: any) {
        if (!active) return;
        setErrorMessage(friendlyCheckoutError(err, 'Não foi possível gerar a cotação para este horário. Tente novamente.'));
      }
    };

    initializeQuote();

    return () => {
      active = false;
      createQuoteInFlightRef.current = false;
    };
  }, [isOpen, provider, vehicle, offering, scheduledDate, startTime, endTime, scheduledStartAt, user?.id]);

  // Quote Expiration Countdown Timer
  useEffect(() => {
    if (!quote || step !== 'QUOTE_PREVIEW') return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000));
      setQuoteTimeRemainingSec(remaining);

      if (remaining <= 0 || isQuoteExpired(quote)) {
        setStep('ERROR_QUOTE_EXPIRED');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [quote, step]);

  // Hold Expiration Countdown Timer
  useEffect(() => {
    if (!booking || !booking.holdExpiresAt || step !== 'PAYMENT_SELECTION') return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(booking.holdExpiresAt!).getTime() - Date.now()) / 1000));
      setHoldTimeRemainingSec(remaining);

      if (remaining <= 0) {
        setErrorMessage('O tempo de retenção deste horário expirou.');
        setStep('ERROR_QUOTE_EXPIRED');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [booking, step]);

  if (!isOpen) return null;
  if (!resumeBooking && (!provider || !vehicle || !offering)) return null;

  // Step 1: Create Booking Hold (Locks calendar slot temporarily)
  const handleProceedToBookingHold = async () => {
    if (isProcessing) return;

    if (!isAuthenticated || !user) {
      setStep('AUTH_REQUIRED');
      return;
    }

    if (!quote) return;

    if (isQuoteExpired(quote)) {
      setStep('ERROR_QUOTE_EXPIRED');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let meetingPoint: { type: 'STUDENT_ADDRESS' | 'PROVIDER_ADDRESS'; address?: string; latitude?: number; longitude?: number } = {
        type: meetingPointType === 'STUDENT' ? 'STUDENT_ADDRESS' : 'PROVIDER_ADDRESS',
      };
      if (meetingPointType === 'STUDENT') {
        if (!studentAddress.trim()) throw new Error('Informe o endereço do aluno para calcular a distância.');
        const geocoded = await geocodeAddress(studentAddress.trim());
        meetingPoint = { ...meetingPoint, address: studentAddress.trim(), latitude: geocoded.latitude, longitude: geocoded.longitude };
      }
      const idempotencyKey = `idem_hold_${quote.id}_${Date.now()}`;

      // Validate the transaction locally before calling the backend.
      const holdResult = createBookingHold({
        quote,
        studentId: user.id,
        studentName: user.name,
        provider,
        vehicle,
        offering,
        existingBookings,
        idempotencyKey,
      });

      let realBookingId = holdResult.booking.id;
      let realPaymentId: string | undefined;

      // The booking hold and payment intent are always created transactionally in Supabase.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.id);
      if (!isUuid) {
        throw new Error('REAL_DATABASE_QUOTE_ID_INVALID');
      }

      try {
        const dbHold = await dbService.createBookingHoldAtMeetingPoint(quote.id, user.id, meetingPoint);
        if (dbHold && dbHold.booking_id) {
          realBookingId = dbHold.booking_id;
        }

        const payRes = await dbService.createBookingPayment(
          realBookingId,
          paymentMethod,
          `idem_pay_${realBookingId}`
        );
        if (payRes && (payRes.payment_id || payRes.id)) {
          realPaymentId = payRes.payment_id || payRes.id;
        } else if (dbHold && dbHold.payment_id) {
          realPaymentId = dbHold.payment_id;
        }
      } catch (dbErr: any) {
        console.error('PAYMENT_CREATE_FAILED / Hold failed on Supabase:', dbErr);
        if (dbErr?.message?.includes('SLOT_NO_LONGER_AVAILABLE') || dbErr?.message?.includes('23P01')) {
          throw new BookingDomainError('Este horário já foi reservado por outro aluno.', 'SLOT_NO_LONGER_AVAILABLE');
        }
        throw dbErr;
      }

      // Sync local booking ID with real DB ID if needed
      const syncedBooking = { ...holdResult.booking, id: realBookingId };
      setBooking(syncedBooking);

      // Create initial Payment entity via PaymentService
      const createPayRes = await paymentService.createPayment({
        request: {
          bookingId: realBookingId,
          method: paymentMethod,
          idempotencyKey: `idem_pay_${realBookingId}`,
        },
        booking: syncedBooking,
        student: user,
        provider,
      });

      setPayment({ ...createPayRes.payment, id: realPaymentId || createPayRes.payment.id });
      setStep('PAYMENT_SELECTION');
    } catch (err: any) {
      if (err instanceof BookingDomainError && err.code === 'SLOT_NO_LONGER_AVAILABLE') {
        setStep('ERROR_SLOT_UNAVAILABLE');
      } else if (err instanceof QuoteDomainError) {
        setStep('ERROR_QUOTE_EXPIRED');
      } else if (err?.message?.includes('BOOKING_HOLD_EXPIRED')) {
        setErrorMessage('Tempo para pagamento expirado. O agendamento foi cancelado.');
        setStep('ERROR_QUOTE_EXPIRED');
      } else {
        setErrorMessage(friendlyCheckoutError(err, 'Não foi possível reservar este horário no momento. Tente novamente.'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Process Fake Payment Execution (Approved or Declined)
  const handleExecuteFakePayment = async (scenario: 'APPROVED' | 'DECLINED') => {
    if (!booking || !payment || !user) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (scenario === 'APPROVED') {
        const externalPaymentId = `fake_pay_appr_${Date.now()}`;
        const paidAt = new Date().toISOString();

        let activePayment = payment;
        const isRealSupabase = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');

        // If the current payment is FAILED, we must create a new attempt before confirming
        if (activePayment.status === 'FAILED' && isRealSupabase) {
          const retryIdempotencyKey = paymentAttemptId 
            ? `idem_pay_${booking.id}_${paymentAttemptId}` 
            : `idem_pay_${booking.id}_${Date.now()}`;
            
          const newPayRes = await dbService.createBookingPayment(
            booking.id,
            paymentMethod,
            retryIdempotencyKey
          );
          
          if (!newPayRes || (!newPayRes.payment_id && !newPayRes.id)) {
            throw new Error('PAYMENT_UUID_GENERATION_FAILED_ON_RETRY');
          }
          
          const newPaymentId = newPayRes.payment_id || newPayRes.id;
          activePayment = { ...activePayment, id: newPaymentId, status: 'PENDING', idempotencyKey: retryIdempotencyKey };
          setPayment(activePayment);
        }

        // PERSIST IN REAL SUPABASE/POSTGRESQL INSTANCE VIA SECURE DB TRANSACTION (RPC)
        if (isRealSupabase) {
          try {
            await dbService.confirmBookingPayment(
              activePayment.id,
              externalPaymentId,
              paidAt
            );
          } catch (dbErr: any) {
            console.error('PAYMENT_CONFIRM_FAILED:', dbErr);
            throw new Error(`PAYMENT_CONFIRM_FAILED: ${dbErr.message || dbErr}`);
          }
        }

        // Confirm payment at domain level
        const confirmRes = await paymentService.confirmBookingPayment({
          payment: { ...activePayment, method: paymentMethod },
          booking,
          externalPaymentId,
        });

        setBooking(confirmRes.booking);
        setPayment(confirmRes.payment);
        setStep('SUCCESS');
        onBookingConfirmed(confirmRes.booking);
      } else if (scenario === 'DECLINED') {
        const isRealSupabase = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');
        
        // 1. Persist FAILED no banco
        if (isRealSupabase && payment?.id && /^[0-9a-f-]{36}$/.test(payment.id)) {
          try {
            await dbService.markBookingPaymentFailed(
              payment.id,
              'SIMULATED_DECLINED: Pagamento recusado pelo gateway de testes.'
            );
          } catch (failErr: any) {
            console.error('mark_booking_payment_failed error:', failErr);
            throw new Error('PAYMENT_MARK_FAILED_ERROR: Não foi possível atualizar o status do pagamento no banco de dados. Tente novamente.');
          }
        }
        
        // 2. Gerar novo attemptId para próxima tentativa
        setPaymentAttemptId(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `att_${Date.now()}`);

        const failRes = await paymentService.handlePaymentFailure({
          payment,
          booking,
          reason: 'SIMULATED_DECLINED: Pagamento recusado pelo gateway de testes.',
        });

        setBooking(failRes.booking);
        setPayment(failRes.payment);
        setErrorMessage('Pagamento não aprovado. Tente outro cartão ou selecione PIX.');
      }
    } catch (err: any) {
      if (err?.message?.includes('PAYMENT_MARK_FAILED_ERROR')) {
        setErrorMessage('Não foi possível atualizar o status do pagamento no banco de dados. Tente novamente.');
      } else {
        setErrorMessage(friendlyCheckoutError(err, 'Não foi possível processar o pagamento simulado. Tente novamente.'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyPixCode = () => {
    if (payment?.pixQrCode) {
      navigator.clipboard.writeText(payment.pixQrCode);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  const durationMinutes = offering?.durationMinutes || resumeBooking?.snapshot?.durationMinutes;
  const durationLabel = typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
    ? ` (${durationMinutes} min)`
    : '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'SUCCESS'
          ? 'Aula confirmada'
          : step === 'PAYMENT_SELECTION'
          ? 'Confirmar pagamento'
          : 'Confirmar sua aula'
      }
      size="md"
    >
      <div className="space-y-4 text-left">
        {/* Environment Safety Banner */}
        <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-slate-900">Ambiente de Testes:</strong> Pagamento simulado sem cobrança real.
          </span>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Persistent Mock Validation Banner */}
        {step !== 'SUCCESS' && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>Pagamento simulado — nenhum valor será cobrado.</span>
          </div>
        )}

        {/* STEP 1: QUOTE PREVIEW */}
        {step === 'QUOTE_PREVIEW' && quote && (
          <div className="space-y-4">
            {/* Countdown Badge */}
            <div className="flex items-center justify-between rounded-2xl bg-[#202126] border border-[#202126] p-3 text-white" aria-live="polite">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#f6c945] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-white/80">Este valor fica reservado por mais</span>
              </div>
              <span className="font-mono text-sm font-extrabold text-[#f6c945]">
                {formatCountdown(quoteTimeRemainingSec)}
              </span>
            </div>

            {/* Provider & Schedule Summary */}
            <div className="rounded-2xl border border-[#e9e6de] bg-white space-y-3 p-4 sm:p-5 text-xs text-slate-700 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-extrabold text-slate-900 text-base block truncate">
                    {offering.instructorName || provider.name}
                  </span>
                  {offering.instructorName && offering.instructorName !== provider.name && (
                    <span className="text-[11px] text-slate-500 block truncate">{provider.name}</span>
                  )}
                </div>
                <span className="shrink-0 bg-amber-100/80 text-amber-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                  Cat. {offering.category}
                </span>
              </div>

              <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />
                  <span>{formatDateBR(scheduledDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>
                    {scheduledStartAt ? formatTimeBR(scheduledStartAt) : `${startTime} - ${endTime}`}
                    {offering.durationMinutes ? ` (${offering.durationMinutes} min)` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2 text-slate-700 font-medium truncate">
                  <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {vehicle.brand} {vehicle.model}
                    {vehicle.transmission === 'AUTOMATIC' ? ' (Automático)' : vehicle.transmission === 'MANUAL' ? ' (Manual)' : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Commercial Price Breakdown */}
            <div className="rounded-2xl bg-white border border-[#e9e6de] p-4 space-y-2 text-slate-900 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Aula prática{durationLabel}</span>
                <span className="font-semibold text-slate-800">{formatCentsToBRL(quote.priceInCents)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Taxa de serviço</span>
                <span className="font-semibold text-slate-800">{formatCentsToBRL(quote.platformFeeInCents)}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">Total</span>
                <span className="text-xl font-extrabold text-slate-950">{formatCentsToBRL(quote.totalInCents)}</span>
              </div>
            </div>

            {/* Meeting Point Selection */}
            <div className="rounded-2xl border border-[#e9e6de] bg-white p-4 space-y-3">
              <p className="text-xs font-bold text-slate-900">Ponto de encontro</p>
              <div className="grid grid-cols-2 gap-2">
                <ButtonBase
                  type="button"
                  aria-pressed={meetingPointType === 'PROVIDER'}
                  onClick={() => setMeetingPointType('PROVIDER')}
                  className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    meetingPointType === 'PROVIDER'
                      ? 'border-amber-400 bg-amber-50/80 text-slate-950 shadow-2xs'
                      : 'border-[#e9e6de] bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Autoescola / Local</span>
                </ButtonBase>
                <ButtonBase
                  type="button"
                  aria-pressed={meetingPointType === 'STUDENT'}
                  onClick={() => setMeetingPointType('STUDENT')}
                  className={`min-h-[44px] px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                    meetingPointType === 'STUDENT'
                      ? 'border-amber-400 bg-amber-50/80 text-slate-950 shadow-2xs'
                      : 'border-[#e9e6de] bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Meu endereço</span>
                </ButtonBase>
              </div>
              {meetingPointType === 'STUDENT' && (
                <div>
                  <label htmlFor="checkout-student-address" className="mb-1.5 block text-xs font-bold text-slate-700">
                    Endereço completo para o ponto de encontro
                  </label>
                  <Input
                    id="checkout-student-address"
                    value={studentAddress}
                    onChange={(event) => setStudentAddress(event.target.value)}
                    placeholder="Digite seu endereço com número e bairro"
                    className="min-h-[44px] w-full rounded-xl border border-[#e9e6de] bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    required
                  />
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full font-bold shadow-xs"
              isLoading={isProcessing}
              onClick={handleProceedToBookingHold}
              aria-label="Continuar para pagamento da aula"
            >
              Continuar para pagamento
            </Button>
          </div>
        )}

        {/* STEP: AUTH REQUIRED */}
        {step === 'AUTH_REQUIRED' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Identificação Necessária</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Para vincular a reserva com segurança à sua conta, faça login antes de continuar.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-[var(--mazzi-border)] space-y-3">
              <p className="text-sm font-black text-slate-900">Sua sessão expirou</p>
              <p className="text-xs text-slate-600">Entre novamente para continuar com segurança.</p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="w-full min-h-11 font-extrabold"
                onClick={onClose}
              >
                Entrar novamente
              </Button>
            </div>
          </div>
        )}

        {/* STEP: ERROR SLOT UNAVAILABLE (RACE CONDITION) */}
        {step === 'ERROR_SLOT_UNAVAILABLE' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Esse horário acabou de ficar indisponível</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Outro aluno reservou este horário segundos atrás. Por favor, selecione outro horário disponível no calendário.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full min-h-11 font-extrabold"
              onClick={() => { onClose(); onChooseAnotherSlot?.(); }}
            >
              Selecionar Outro Horário
            </Button>
          </div>
        )}

        {/* STEP: ERROR QUOTE EXPIRED */}
        {step === 'ERROR_QUOTE_EXPIRED' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">{errorMessage ? 'Atenção' : 'Esta cotação expirou'}</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                {errorMessage || 'O tempo de garantia de preço e retenção do horário encerrou. Por favor, selecione novamente o horário.'}
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full min-h-11 font-extrabold"
              onClick={() => {
                onClose();
                onChooseAnotherSlot?.();
              }}
            >
              Voltar ao Calendário
            </Button>
          </div>
        )}

        {/* STEP: PAYMENT SELECTION (FAKE GATEWAY EXECUTION) */}
        {step === 'PAYMENT_SELECTION' && booking && payment && (
          <div className="space-y-4">
            {/* Hold Expiration Counter */}
            <div className="flex items-center justify-between rounded-2xl bg-[#202126] border border-[#202126] p-3 text-white" aria-live="polite">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#f6c945] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-white/80">Horário reservado temporariamente por mais</span>
              </div>
              <span className="font-mono text-sm font-extrabold text-[#f6c945]">
                {formatCountdown(holdTimeRemainingSec)}
              </span>
            </div>

            {/* Total summary banner */}
            <div className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-4 flex items-center justify-between text-slate-900">
              <span className="text-xs font-bold text-slate-700">Total a pagar</span>
              <span className="text-xl font-extrabold text-slate-950">{formatCentsToBRL(payment.amountInCents)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <ButtonBase
                type="button"
                aria-pressed={paymentMethod === 'PIX'}
                onClick={() => setPaymentMethod('PIX')}
                className={`min-h-[44px] p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                  paymentMethod === 'PIX'
                    ? 'border-amber-400 bg-amber-50/80 shadow-2xs'
                    : 'border-[#e9e6de] bg-white hover:border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-slate-900 block truncate">PIX Simulado</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Aprovação instantânea</span>
                </div>
              </ButtonBase>

              <ButtonBase
                type="button"
                aria-pressed={paymentMethod === 'CREDIT_CARD'}
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`min-h-[44px] p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-amber-400 bg-amber-50/80 shadow-2xs'
                    : 'border-[#e9e6de] bg-white hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-slate-900 block truncate">Cartão Simulado</span>
                  <span className="text-[10px] text-slate-500 font-medium block truncate">Testar cenários</span>
                </div>
              </ButtonBase>
            </div>

            {/* PIX Fake View */}
            {paymentMethod === 'PIX' && (
              <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] text-center space-y-3 shadow-2xs">
                <p className="text-xs font-bold text-slate-800">Código PIX Copia e Cola (Simulado)</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600 break-all select-all">
                  {payment.pixQrCode || `FAKE_PIX_SIMULATED_PAYMENT_ENV_DEVELOPMENT_${payment.id}`}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full min-h-[44px] font-bold"
                  onClick={handleCopyPixCode}
                  leftIcon={copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  aria-label="Copiar código PIX para a área de transferência"
                >
                  {copiedPix ? 'Código Copiado!' : 'Copiar Código PIX'}
                </Button>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full font-bold shadow-xs"
                    isLoading={isProcessing}
                    disabled={isProcessing}
                    onClick={() => handleExecuteFakePayment('APPROVED')}
                    aria-label="Confirmar pagamento PIX"
					leftIcon={<CheckCircle2 className="w-4 h-4 text-slate-950" aria-hidden="true" />}
                  >
                    Confirmar pagamento
                  </Button>
                </div>
              </div>
            )}

            {/* Credit Card Fake View */}
            {paymentMethod === 'CREDIT_CARD' && (
              <div className="p-4 rounded-2xl bg-white border border-[#e9e6de] space-y-3 shadow-2xs">
                <p className="text-xs font-bold text-slate-800 text-center">
                  Simulador de Testes de Cartão
                </p>

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full font-bold shadow-xs"
                    isLoading={isProcessing}
                    disabled={isProcessing}
                    onClick={() => handleExecuteFakePayment('APPROVED')}
                    leftIcon={<CheckCircle2 className="w-4 h-4 text-slate-950" aria-hidden="true" />}
                    aria-label="Confirmar pagamento do cartão"
                  >
                    Confirmar pagamento
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full min-h-[44px] font-bold text-rose-700 border-rose-200 hover:bg-rose-50"
                    isLoading={isProcessing}
                    disabled={isProcessing}
                    onClick={() => handleExecuteFakePayment('DECLINED')}
                    leftIcon={<XCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />}
                    aria-label="Simular pagamento de cartão recusado"
                  >
                    Simular Pagamento Recusado
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === 'SUCCESS' && booking && (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--mazzi-yellow)] text-slate-950 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>

            <div>
              <h3 className="font-black text-lg text-slate-900">Aula Agendada com Sucesso!</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Sua reserva está confirmada. Você pode acompanhar todos os detalhes na aba de Aulas.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                <span>Reserva confirmada em ambiente de validação.</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5">
              <p className="font-extrabold text-slate-900">{booking.instructorName || booking.providerName}</p>
              <p className="text-slate-600">
                {booking.scheduledStartAt
                  ? `${formatDateBR(booking.scheduledStartAt)} às ${formatTimeBR(booking.scheduledStartAt)}`
                  : `${formatDateBR(booking.scheduledDate)} às ${booking.startTime}`}
              </p>
              <p className="text-slate-500">Ponto de Encontro: {formatMeetingPoint(booking.meetingPoint)}</p>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full min-h-11 font-extrabold"
              onClick={() => {
                onClose();
                onGoToBookings?.();
              }}
              aria-label="Ir para a listagem das minhas aulas"
            >
              Ver Minhas Aulas
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};


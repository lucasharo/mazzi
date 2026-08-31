import React, { useState, useEffect } from 'react';
import { ShieldCheck, CreditCard, QrCode, Clock, AlertCircle, CheckCircle2, XCircle, Copy, Check, Building2, Car, UserCheck, Calendar, Lock, Sparkles, ArrowLeft, KeyRound, MapPin, AlertTriangle, } from 'lucide-react';
import {
  Provider, Vehicle, ServiceOffering, Quote, Booking, Payment, PaymentMethodType, StudentSavedAddress, } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button, ButtonBase } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { formatCentsToBRL } from '../../../domain/money';
import { isQuoteExpired, QuoteDomainError } from '../../../domain/quote';
import { createBookingHold, BookingDomainError, PAYMENT_HOLD_EXPIRATION_MINUTES } from '../../../domain/booking';
import { PaymentService } from '../../../domain/payments/payment-service';
import { FakePaymentGateway } from '../../../domain/payments/fake-adapter';
import { useAuth } from '../../../components/auth/AuthContext';
import { supabase } from '../../../lib/supabase';
import { dbService } from '../../../lib/db-service';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { formatDateBR, formatTimeBR } from '../../../lib/date-format';
import { geocodeAddress } from '../../../lib/geocoding';
import { getCheckoutGatewayProvider, getStripeEnvironment, getStripePublishableKey } from '../../../lib/payment-gateway-config';
import { StripeHostedCheckout } from './StripeHostedCheckout';
import { ConfirmableAddressAutocomplete } from '../../../components/search/ConfirmableAddressAutocomplete';
import { LocationSuggestion } from '../../../domain/maps/geocoding-provider';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentation?: 'modal' | 'page';
  provider: Provider | null;
  vehicle: Vehicle | null;
  offering: ServiceOffering | null;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  scheduledStartAt?: string; // ISO String
  onGoToBookings?: () => void;
  onChooseAnotherSlot?: () => void;
  onBookingCancelled?: () => void;
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
  if (technicalMessage.includes('SLOT_MUST_BE_IN_FUTURE')) {
    return 'Esse horário já passou. Escolha uma data e um horário futuros.';
  }
  if (technicalMessage.includes('OFFERING_NOT_FOUND_OR_INACTIVE')) {
    return 'Esta oferta não está mais disponível. Escolha outro instrutor ou veículo.';
  }
  if (technicalMessage.includes('PROVIDER_NOT_ACTIVE') || technicalMessage.includes('OFFERING_PROVIDER_NOT_ACTIVE')) {
    return 'Este prestador não está disponível para novas reservas no momento.';
  }
  if (technicalMessage.includes('VEHICLE_NOT_ACTIVE') || technicalMessage.includes('OFFERING_VEHICLE_NOT_ACTIVE')) {
    return 'Este veículo não está disponível para novas reservas no momento.';
  }
  if (technicalMessage.includes('STUDENT_ID_MISMATCH')) {
    return 'Sua sessão não corresponde ao aluno desta reserva. Atualize a página e tente novamente.';
  }
  if (technicalMessage.includes('STRIPE_PIX_NOT_ENABLED')) {
    return 'O Pix ainda não está habilitado na conta Stripe. Ative Pix em Payment methods no Dashboard e tente novamente.';
  }

  return fallback;
}

function formatCheckoutDate(value?: string | null): string {
  if (!value) return 'Data não informada';
  try {
    return formatDateBR(value);
  } catch {
    return value;
  }
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  presentation = 'modal',
  provider,
  vehicle,
  offering,
  scheduledDate,
  startTime,
  endTime,
  scheduledStartAt,
  onGoToBookings,
  onChooseAnotherSlot,
  onBookingCancelled,
  existingBookings = [],
  onBookingConfirmed,
  resumeBooking,
}) => {
  const { user, isAuthenticated } = useAuth();
  const checkoutGatewayProvider = getCheckoutGatewayProvider();
  const stripeEnvironment = getStripeEnvironment(getStripePublishableKey());
  const showTestCopy = checkoutGatewayProvider === 'fake' || stripeEnvironment === 'test';

  const [step, setStep] = useState<CheckoutStep>('QUOTE_PREVIEW');
  const [successAnimationPhase, setSuccessAnimationPhase] = useState<'LOADING' | 'TRANSITION' | 'COMPLETE'>('LOADING');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentAttemptId, setPaymentAttemptId] = useState<string | null>(null);
  const [stripePaymentPending, setStripePaymentPending] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [meetingPointType, setMeetingPointType] = useState<'PROVIDER' | 'STUDENT'>('PROVIDER');
  const [studentAddress, setStudentAddress] = useState('');
  const [studentAddressLocation, setStudentAddressLocation] = useState<StudentSavedAddress | null>(null);

  // Time remaining counters
  const [quoteTimeRemainingSec, setQuoteTimeRemainingSec] = useState<number>(600);
  const [holdTimeRemainingSec, setHoldTimeRemainingSec] = useState<number>(600);

  // The fake gateway is used only for the explicitly selected fake mode.
  const paymentService = React.useMemo(() => {
    return checkoutGatewayProvider === 'fake' ? new PaymentService(new FakePaymentGateway()) : null;
  }, [checkoutGatewayProvider]);

  const createQuoteInFlightRef = React.useRef(false);
  const checkoutAttemptIdRef = React.useRef<string>('');

  // Reset and generate quote when modal opens or params change
  useEffect(() => {
    let active = true;

    setQuote(null);
    setErrorMessage(null);
    setBooking(null);
    setPayment(null);
    setPaymentMethod(null);
    setStripePaymentPending(false);
    setStudentAddress(user?.studentSavedAddress?.formattedAddress || '');
    setStudentAddressLocation(user?.studentSavedAddress || null);
    setStep('QUOTE_PREVIEW');

    if (!isOpen) {
      checkoutAttemptIdRef.current = '';
      return;
    }

    if (resumeBooking) {
      setBooking(resumeBooking);
      setPayment(null);
      setPaymentMethod(null);
      setStep('PAYMENT_SELECTION');
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
  }, [isOpen, provider?.id, vehicle?.id, offering?.id, scheduledDate, startTime, endTime, scheduledStartAt, user?.id]);

  useEffect(() => {
    if (step !== 'SUCCESS') {
      setSuccessAnimationPhase('LOADING');
      return undefined;
    }

    const transitionTimer = window.setTimeout(() => setSuccessAnimationPhase('TRANSITION'), 700);
    const completeTimer = window.setTimeout(() => setSuccessAnimationPhase('COMPLETE'), 1400);
    return () => {
      window.clearTimeout(transitionTimer);
      window.clearTimeout(completeTimer);
    };
  }, [step]);

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

    let active = true;
    let tick = 0;
    let paymentStatusCheckInFlight = false;
    const isRealSupabase = Boolean((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));

    const hasGeneratedGatewayAttempt = Boolean(
      stripePaymentPending && payment?.gateway === 'STRIPE' && (
        payment.externalPaymentId || payment.metadata?.stripe_checkout_session_id
      ),
    );

    const reconcilePaymentStatus = async (): Promise<'PAID' | 'NOT_PAID' | 'UNKNOWN'> => {
      if (!active || paymentStatusCheckInFlight || !isRealSupabase || !payment?.id || !/^[0-9a-f-]{36}$/i.test(payment.id) || !hasGeneratedGatewayAttempt) {
        return 'UNKNOWN';
      }

      paymentStatusCheckInFlight = true;
      try {
        // The local database is authoritative. Stripe's webhook confirms the
        // booking; the browser only reconciles the local status.
        const currentStatus = await dbService.getMyPaymentStatus(payment.id);
        const isPaid = currentStatus?.status === 'PAID' || currentStatus?.approved;
        if (!active) return 'UNKNOWN';
        if (!isPaid) {
          if (currentStatus?.status === 'FAILED') {
            setStripePaymentPending(false);
            setPayment((current) => current ? { ...current, status: 'FAILED', updatedAt: new Date().toISOString() } : current);
            return 'NOT_PAID';
          }
          return 'UNKNOWN';
        }

        const confirmedBooking = { ...booking, status: 'CONFIRMED' as const, updatedAt: new Date().toISOString() };
        setBooking(confirmedBooking);
        setPayment((current) => current ? {
          ...current,
          status: 'PAID',
          externalPaymentId: currentStatus.externalPaymentId || currentStatus.external_payment_id || current.externalPaymentId,
          paidAt: currentStatus.paidAt || currentStatus.paid_at || current.paidAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } : current);
        setStep('SUCCESS');
        onBookingConfirmed(confirmedBooking);
        return 'PAID';
      } catch (statusError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('PAYMENT_STATUS_RECONCILIATION_PENDING:', statusError);
        }
        return 'UNKNOWN';
      } finally {
        paymentStatusCheckInFlight = false;
      }
    };

    const timer = setInterval(async () => {
      if (!active) return;
      const remaining = Math.max(0, Math.floor((new Date(booking.holdExpiresAt!).getTime() - Date.now()) / 1000));
      setHoldTimeRemainingSec(remaining);
      tick += 1;

      // Reconcile periodically while the student is paying and always before
      // expiring the hold. A confirmed payment must never become an expiration
      // or slot-unavailable message because the client missed a response.
      if (remaining > 0 && tick % 5 !== 0) return;
      const paymentStatus = await reconcilePaymentStatus();
      if (paymentStatus === 'PAID' || !active) return;

      const canExpireHold = !isRealSupabase || !payment?.id || !/^[0-9a-f-]{36}$/i.test(payment.id) || !hasGeneratedGatewayAttempt || paymentStatus === 'NOT_PAID';
      if (remaining <= 0 && canExpireHold) {
        setErrorMessage('O tempo de retenção deste horário expirou.');
        setStep('ERROR_QUOTE_EXPIRED');
      }
    }, 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [booking, stripePaymentPending, payment, step, onBookingConfirmed]);

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
    setStripePaymentPending(false);

    try {
      let meetingPoint: { type: 'STUDENT_ADDRESS' | 'PROVIDER_ADDRESS'; address?: string; latitude?: number; longitude?: number } = {
        type: meetingPointType === 'STUDENT' ? 'STUDENT_ADDRESS' : 'PROVIDER_ADDRESS',
      };
      if (meetingPointType === 'STUDENT') {
        if (!studentAddress.trim()) throw new Error('Informe o endereço do aluno para calcular a distância.');
        const geocoded = studentAddressLocation?.formattedAddress === studentAddress.trim()
          ? studentAddressLocation
          : await geocodeAddress(studentAddress.trim());
        meetingPoint = { ...meetingPoint, address: studentAddress.trim(), latitude: geocoded.latitude, longitude: geocoded.longitude };
      }
      const idempotencyKey = `idem_hold_${quote.id}_${Date.now()}`;
      let dbHold: any = null;

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
        holdDurationMinutes: PAYMENT_HOLD_EXPIRATION_MINUTES,
      });

      let realBookingId = holdResult.booking.id;

      // The booking hold and payment intent are always created transactionally in Supabase.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.id);
      if (!isUuid) {
        throw new Error('REAL_DATABASE_QUOTE_ID_INVALID');
      }

      try {
        dbHold = await dbService.createBookingHoldAtMeetingPoint(quote.id, user.id, meetingPoint);
        if (dbHold && dbHold.booking_id) {
          realBookingId = dbHold.booking_id;
        }

      } catch (dbErr: any) {
        console.error('PAYMENT_CREATE_FAILED / Hold failed on Supabase:', dbErr);
        if (dbErr?.message?.includes('SLOT_NO_LONGER_AVAILABLE') || dbErr?.message?.includes('23P01')) {
          throw new BookingDomainError('Este horário já foi reservado por outro aluno.', 'SLOT_NO_LONGER_AVAILABLE');
        }
        throw dbErr;
      }

      if (meetingPointType === 'STUDENT' && meetingPoint.latitude !== undefined && meetingPoint.longitude !== undefined) {
        const savedAddress: StudentSavedAddress = studentAddressLocation?.formattedAddress === studentAddress.trim()
          ? studentAddressLocation
          : { formattedAddress: studentAddress.trim(), latitude: meetingPoint.latitude, longitude: meetingPoint.longitude };
        void dbService.updateMyStudentAddress(savedAddress).catch((error) => {
          if (import.meta.env.DEV) console.warn('STUDENT_ADDRESS_SAVE_FAILED', error);
        });
      }

      // Sync local booking ID with real DB ID if needed
      const syncedBooking = {
        ...holdResult.booking,
        id: realBookingId,
        holdExpiresAt: dbHold?.hold_expires_at || holdResult.booking.holdExpiresAt,
      };

      if (checkoutGatewayProvider === 'stripe') {
        const nextPayment = await createPaymentAttempt('CREDIT_CARD', syncedBooking);
        setBooking(syncedBooking);
        setPayment(nextPayment);
        setPaymentMethod('CREDIT_CARD');
        await handleStripeHostedCheckout(nextPayment);
        return;
      }

      setBooking(syncedBooking);
      setPayment(null);
      setPaymentMethod(null);
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
    if (!booking || !payment || !paymentMethod || !user) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (scenario === 'APPROVED') {
        const externalPaymentId = `fake_pay_appr_${Date.now()}`;
        const paidAt = new Date().toISOString();

        let activePayment = payment;
        const isRealSupabase = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');

        // If the current payment is FAILED, we must create a new attempt before confirming
        if (activePayment.status === 'FAILED' && isRealSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(booking.id)) {
          const retryIdempotencyKey = paymentAttemptId 
            ? `idem_pay_${booking.id}_${paymentAttemptId}` 
            : `idem_pay_${booking.id}_${Date.now()}`;
            
          const newPayRes = await dbService.createBookingPayment(
            booking.id,
            paymentMethod,
            retryIdempotencyKey,
            checkoutGatewayProvider === 'stripe' ? 'stripe' : 'fake_payment_gateway'
          );
          
          if (!newPayRes || (!newPayRes.payment_id && !newPayRes.id)) {
            throw new Error('PAYMENT_UUID_GENERATION_FAILED_ON_RETRY');
          }
          
          const newPaymentId = newPayRes.payment_id || newPayRes.id;
          activePayment = { ...activePayment, id: newPaymentId, status: 'PENDING', idempotencyKey: retryIdempotencyKey };
          setPayment(activePayment);
        }

        // PERSIST IN REAL SUPABASE/POSTGRESQL INSTANCE VIA SECURE DB TRANSACTION (RPC)
        if (isRealSupabase && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activePayment.id)) {
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

  const createPaymentAttempt = async (nextMethod: PaymentMethodType, bookingOverride?: Booking): Promise<Payment> => {
    const activeBooking = bookingOverride || booking;
    if (!activeBooking || !user) throw new Error('PAYMENT_CONTEXT_UNAVAILABLE');

    const isRealSupabase = Boolean(
      (import.meta as any).env?.VITE_SUPABASE_URL &&
      !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'),
    );
    const attemptId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const idempotencyKey = `idem_pay_${activeBooking.id}_${nextMethod.toLowerCase()}_${attemptId}`;
    const hasRealBookingId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeBooking.id);

    if (isRealSupabase && hasRealBookingId) {
      const payRes = await dbService.createBookingPayment(
        activeBooking.id,
        nextMethod,
        idempotencyKey,
        checkoutGatewayProvider === 'stripe' ? 'stripe' : 'fake_payment_gateway',
      );
      const nextPaymentId = payRes?.payment_id || payRes?.id;
      if (!nextPaymentId || !/^[0-9a-f-]{36}$/i.test(nextPaymentId)) {
        throw new Error('PAYMENT_UUID_GENERATION_FAILED');
      }
      const now = new Date().toISOString();
      const amountInCents = activeBooking.snapshot?.totalInCents || activeBooking.totalInCents;
      const platformFeeInCents = activeBooking.snapshot?.platformFeeInCents || activeBooking.platformFeeInCents;
      if (checkoutGatewayProvider === 'stripe') {
        return {
          id: nextPaymentId,
          bookingId: activeBooking.id,
          studentId: activeBooking.studentId,
          providerId: activeBooking.providerId,
          gateway: 'STRIPE',
          idempotencyKey,
          method: nextMethod,
          status: 'PENDING',
          amountInCents,
          platformFeeInCents,
          providerAmountInCents: activeBooking.snapshot?.priceInCents || (amountInCents - platformFeeInCents),
          metadata: { stripeStatus: 'NOT_STARTED', stripe_payment_method: nextMethod },
          createdAt: now,
          updatedAt: now,
        };
      }
      return {
        id: nextPaymentId,
        bookingId: activeBooking.id,
        studentId: activeBooking.studentId,
        providerId: activeBooking.providerId,
        gateway: 'DEVELOPMENT_MOCK',
        idempotencyKey,
        method: nextMethod,
        status: 'PENDING',
        amountInCents,
        platformFeeInCents,
        providerAmountInCents: activeBooking.snapshot?.priceInCents || (amountInCents - platformFeeInCents),
        createdAt: now,
        updatedAt: now,
      };
    }

    if (!paymentService) throw new Error('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION');
    const now = new Date().toISOString();
    const amountInCents = activeBooking.snapshot?.totalInCents || activeBooking.totalInCents;
    const platformFeeInCents = activeBooking.snapshot?.platformFeeInCents || activeBooking.platformFeeInCents;
    return {
      id: `pay_fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      bookingId: activeBooking.id,
      studentId: activeBooking.studentId,
      providerId: activeBooking.providerId,
      gateway: 'DEVELOPMENT_MOCK',
      idempotencyKey,
      method: nextMethod,
      status: 'PENDING',
      amountInCents,
      platformFeeInCents,
      providerAmountInCents: activeBooking.snapshot?.priceInCents || (amountInCents - platformFeeInCents),
      pixQrCode: nextMethod === 'PIX' ? `FAKE_PIX_SIMULATED_PAYMENT_ENV_DEVELOPMENT_${activeBooking.id}` : undefined,
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleSelectPaymentMethod = async (nextMethod: PaymentMethodType) => {
    if (isProcessing || stripePaymentPending || (nextMethod === paymentMethod && payment?.status !== 'FAILED') || !booking || !user) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setStripePaymentPending(false);
    try {
      const nextPayment = await createPaymentAttempt(nextMethod);
      setPayment(nextPayment);
      setPaymentMethod(nextMethod);
    } catch (error) {
      setErrorMessage(friendlyCheckoutError(error, 'Não foi possível selecionar esta forma de pagamento. Tente novamente.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Stripe Checkout owns the payment-method choice. The local payment row is
  // created once with a neutral card value because the database requires a
  // method before the hosted session exists; the signed webhook remains the
  // source of truth for the actual method and payment result.
  useEffect(() => {
    if (checkoutGatewayProvider !== 'stripe' || step !== 'PAYMENT_SELECTION' || !booking || !user || payment) return undefined;
    let active = true;
    setIsProcessing(true);
    setErrorMessage(null);
    void createPaymentAttempt('CREDIT_CARD')
      .then((nextPayment) => {
        if (!active) return;
        setPayment(nextPayment);
        setPaymentMethod('CREDIT_CARD');
      })
      .catch((error) => {
        if (active) setErrorMessage(friendlyCheckoutError(error, 'Não foi possível iniciar o checkout. Tente novamente.'));
      })
      .finally(() => {
        if (active) setIsProcessing(false);
      });
    return () => {
      active = false;
    };
  }, [checkoutGatewayProvider, step, booking?.id, user?.id, payment]);

  const handleStripeHostedCheckout = async (paymentOverride?: Payment) => {
    const activePayment = paymentOverride || payment;
    const activePaymentMethod = paymentOverride?.method || paymentMethod;
    if (!activePayment || !activePaymentMethod || !user || stripePaymentPending) return;

    setIsProcessing(true);
    setErrorMessage(null);
    let redirected = false;
    try {
      const session = await dbService.createStripeCheckoutSession(
        activePayment.id,
        activePaymentMethod,
        user.email,
        window.location.origin,
      );
      setPayment((current) => current ? {
        ...current,
        gateway: 'STRIPE',
        status: 'PENDING',
        metadata: {
          ...(current.metadata || {}),
          stripe_checkout_session_id: session.checkoutSessionId,
          stripe_checkout_status: session.status,
        },
        updatedAt: new Date().toISOString(),
      } : current);
      setStripePaymentPending(true);
      redirected = true;
      window.location.assign(session.checkoutUrl);
    } catch (error) {
      setErrorMessage(friendlyCheckoutError(error, 'Não foi possível abrir o Checkout Stripe. Tente novamente.'));
    } finally {
      if (!redirected) setIsProcessing(false);
    }
  };

  const handleRefreshStripePayment = async () => {
    if (!payment || !booking || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const currentStatus = await dbService.getMyPaymentStatus(payment.id);
      if (currentStatus?.status === 'PAID' || currentStatus?.booking_status === 'CONFIRMED') {
        const confirmedBooking = { ...booking, status: 'CONFIRMED' as const, updatedAt: new Date().toISOString() };
        setBooking(confirmedBooking);
        setPayment((current) => current ? { ...current, status: 'PAID', paidAt: currentStatus.paid_at || new Date().toISOString(), updatedAt: new Date().toISOString() } : current);
        setStep('SUCCESS');
        onBookingConfirmed(confirmedBooking);
      } else if (currentStatus?.status === 'FAILED') {
        setStripePaymentPending(false);
        setPayment((current) => current ? { ...current, status: 'FAILED', updatedAt: new Date().toISOString() } : current);
        setErrorMessage('O pagamento não foi aprovado. Escolha outra forma de pagamento.');
      } else {
        setErrorMessage('O pagamento ainda está sendo processado.');
      }
    } catch (error) {
      setErrorMessage(friendlyCheckoutError(error, 'Ainda não conseguimos consultar o pagamento. Tente novamente.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPendingBooking = async () => {
    if (!booking || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await dbService.cancelPendingBooking(booking.id);
      onBookingCancelled?.();
      onClose();
      onChooseAnotherSlot?.();
    } catch (error) {
      setErrorMessage(friendlyCheckoutError(error, 'Não foi possível cancelar esta reserva. Tente novamente.'));
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
  const checkoutFormValid = Boolean(
    quote &&
    !isProcessing &&
    (meetingPointType === 'PROVIDER' || studentAddress.trim()),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'SUCCESS'
          ? 'Aula confirmada'
          : step === 'PAYMENT_SELECTION'
          ? 'Resumo da reserva'
          : 'Confirmar sua aula'
      }
      size="md"
      presentation={presentation}
    >
      <div className="space-y-4 text-left">
        {step === 'SUCCESS' && successAnimationPhase !== 'COMPLETE' && (
          <div
            className={`fixed inset-0 z-[95] flex items-center justify-center bg-emerald-500 px-6 text-center text-white transition-opacity duration-500 ${
              successAnimationPhase === 'TRANSITION' ? 'opacity-0' : 'opacity-100'
            }`}
            role="status"
            aria-live="polite"
            aria-label="Pagamento confirmado"
          >
            <div className={`mazzi-success-overlay-icon relative flex h-24 w-24 items-center justify-center rounded-[2rem] border-2 border-emerald-100 bg-emerald-50 text-emerald-600 shadow-[0_16px_36px_rgba(6,95,70,0.3)] ${
              successAnimationPhase === 'TRANSITION' ? 'mazzi-success-overlay-icon-exit' : ''
            }`}>
              <CheckCircle2 className="h-14 w-14" strokeWidth={2.5} aria-hidden="true" />
              <Sparkles className="absolute -right-2 -top-2 h-5 w-5 fill-emerald-300 text-emerald-50" aria-hidden="true" />
              <Sparkles className="absolute -bottom-2 -left-2 h-4 w-4 fill-emerald-200 text-emerald-50" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div role={stripePaymentPending ? 'status' : 'alert'} aria-live="polite" className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2 ${stripePaymentPending ? 'bg-amber-50 border border-amber-200 text-amber-950' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
            {stripePaymentPending
              ? <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              : <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />}
            <div className="flex-1">
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Payment environment banner */}
        {showTestCopy && step !== 'SUCCESS' && checkoutGatewayProvider === 'fake' && (
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
                  <label htmlFor="checkout-student-address" className="mazzi-field-label mb-1.5 block">
                    Endereço completo para o ponto de encontro
                  </label>
                  <ConfirmableAddressAutocomplete
                    id="checkout-student-address"
                    value={studentAddress}
                    onChange={(value) => {
                      setStudentAddress(value);
                      setStudentAddressLocation(null);
                    }}
                    onConfirm={(suggestion: LocationSuggestion | null) => {
                      if (suggestion) {
                        setStudentAddressLocation({
                          formattedAddress: suggestion.formattedAddress,
                          latitude: suggestion.latitude,
                          longitude: suggestion.longitude,
                          postalCode: suggestion.postalCode,
                          placeId: suggestion.placeId,
                          addressLine1: suggestion.addressLine1,
                          addressLine2: suggestion.addressLine2,
                          neighborhood: suggestion.neighborhood,
                          city: suggestion.city,
                          state: suggestion.stateCode || suggestion.state,
                          country: suggestion.country,
                        });
                      }
                    }}
                    onClear={() => setStudentAddressLocation(null)}
                    placeholder="Digite seu endereço com número e bairro"
                    ariaLabel="Endereço completo para o ponto de encontro"
                    dropdownAlignment="viewport"
                    inputClassName="min-h-[44px] rounded-xl border border-[#e9e6de] bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
              disabled={!checkoutFormValid}
              onClick={handleProceedToBookingHold}
              aria-label="Continuar para pagamento da aula"
            >
              Continuar para pagamento
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full min-h-11 font-extrabold text-[var(--mazzi-text)]"
              onClick={() => {
                onClose();
                onChooseAnotherSlot?.();
              }}
              aria-label="Voltar e escolher outro horário"
            >
              Voltar e escolher outro horário
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
        {step === 'PAYMENT_SELECTION' && booking && (
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

            {/* Reservation summary: the student reviews the selected details before leaving for Stripe. */}
            <div className="rounded-2xl border border-[var(--mazzi-border)] bg-white p-3 shadow-2xs">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="mazzi-field-label">Confira sua aula</p>
                  <p className="mt-0.5 text-sm font-extrabold text-[var(--mazzi-dark)]">Resumo da reserva</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-900">
                  Cat. {booking.snapshot?.category ?? booking.category}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 border-y border-slate-100">
                <div className="col-span-2 flex items-start gap-2.5 border-b border-slate-100 py-2.5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">Data e horário</p>
                    <p className="text-sm font-extrabold text-[var(--mazzi-dark)]">
                      {formatCheckoutDate(booking.scheduledDate)} · {booking.startTime || '--:--'} às {booking.endTime || '--:--'}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2.5 border-b border-slate-100 py-2.5">
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">Instrutor</p>
                    <p className="break-words text-[13px] font-extrabold leading-snug text-[var(--mazzi-dark)]">{booking.snapshot?.instructorName ?? booking.instructorName}</p>
                    <p className="break-words text-[11px] font-medium leading-snug text-slate-500">{booking.snapshot?.providerName ?? booking.providerName}</p>
                  </div>
                </div>

                <div className="flex min-w-0 items-start gap-2.5 border-b border-slate-100 py-2.5">
                  <Car className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">Veículo</p>
                    <p className="break-words text-[13px] font-extrabold leading-snug text-[var(--mazzi-dark)]">{booking.snapshot?.vehicleName ?? booking.vehicleName}</p>
                    <p className="text-[11px] font-medium leading-snug text-slate-500">
                      {booking.snapshot?.transmission === 'AUTOMATIC' ? 'Automático' : booking.snapshot?.transmission === 'MANUAL' ? 'Manual' : 'Câmbio não informado'}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 flex items-start gap-2.5 py-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500">Ponto de encontro</p>
                    <p className="text-sm font-extrabold text-[var(--mazzi-dark)]">{formatMeetingPoint(booking.meetingPoint) || 'Local do instrutor'}</p>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-between border-t border-amber-200/70 bg-amber-50/60 px-2 py-2.5">
                  <span className="text-xs font-bold text-slate-800">Total a pagar</span>
                  <span className="text-lg font-extrabold text-slate-950">{formatCentsToBRL(payment?.amountInCents ?? booking.totalInCents)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector — retained for the fake gateway only. */}
            {checkoutGatewayProvider === 'fake' && <div className="grid grid-cols-2 gap-2">
              <ButtonBase
                type="button"
                aria-pressed={paymentMethod === 'PIX'}
                disabled={isProcessing || stripePaymentPending}
                onClick={() => { void handleSelectPaymentMethod('PIX'); }}
                className={`min-h-[44px] p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                  paymentMethod === 'PIX'
                    ? 'border-amber-400 bg-amber-50/80 shadow-2xs'
                    : 'border-[#e9e6de] bg-white hover:border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-slate-900 block truncate">{checkoutGatewayProvider === 'fake' && showTestCopy ? 'PIX Simulado' : 'Pix'}</span>
                  {showTestCopy && <span className="text-[10px] text-slate-500 font-medium block truncate">{checkoutGatewayProvider === 'fake' ? 'Aprovação instantânea' : 'QR Code de teste'}</span>}
                </div>
              </ButtonBase>

              <ButtonBase
                type="button"
                aria-pressed={paymentMethod === 'CREDIT_CARD'}
                disabled={isProcessing || stripePaymentPending}
                onClick={() => { void handleSelectPaymentMethod('CREDIT_CARD'); }}
                className={`min-h-[44px] p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-amber-400 bg-amber-50/80 shadow-2xs'
                    : 'border-[#e9e6de] bg-white hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-slate-900 block truncate">{checkoutGatewayProvider === 'fake' && showTestCopy ? 'Cartão de Crédito Simulado' : 'Cartão de Crédito'}</span>
                  {showTestCopy && <span className="text-[10px] text-slate-500 font-medium block truncate">{checkoutGatewayProvider === 'fake' ? 'Testar cenários' : 'Cartão de teste'}</span>}
                </div>
              </ButtonBase>
            </div>}

            {checkoutGatewayProvider === 'fake' && !paymentMethod && (
              <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-[var(--mazzi-muted)]">
                Selecione uma forma de pagamento para continuar.
              </p>
            )}

            {/* PIX Fake View */}
            {checkoutGatewayProvider === 'fake' && paymentMethod === 'PIX' && payment && (
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

            {checkoutGatewayProvider === 'stripe' && paymentMethod && payment && (
              <StripeHostedCheckout
                amountInCents={payment.amountInCents}
                isProcessing={isProcessing || stripePaymentPending}
                onCheckout={() => { void handleStripeHostedCheckout(); }}
              />
            )}

            {/* Credit Card Fake View */}
            {checkoutGatewayProvider === 'fake' && paymentMethod === 'CREDIT_CARD' && payment && (
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

            {checkoutGatewayProvider === 'stripe' && stripePaymentPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full font-bold"
                isLoading={isProcessing}
                disabled={isProcessing}
                onClick={() => { void handleRefreshStripePayment(); }}
              >
                Atualizar status do pagamento
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full min-h-11 font-extrabold text-[var(--mazzi-text)]"
              isLoading={isProcessing}
              disabled={isProcessing || stripePaymentPending}
              onClick={() => { void handleCancelPendingBooking(); }}
              aria-label="Cancelar a reserva e escolher outro horário"
            >
              Voltar e escolher outro horário
            </Button>
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === 'SUCCESS' && booking && (
          <div className="space-y-4 py-4 text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <div className={`relative flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-emerald-200 bg-emerald-50 text-emerald-600 ${
                successAnimationPhase === 'LOADING' ? 'scale-75 opacity-0' : 'mazzi-success-final'
              }`}>
                <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} aria-hidden="true" />
                <Sparkles className="absolute -right-2 -top-2 h-4 w-4 fill-emerald-300 text-emerald-50" aria-hidden="true" />
                <Sparkles className="absolute -bottom-2 -left-2 h-3.5 w-3.5 fill-emerald-200 text-emerald-50" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Reserva confirmada
              </span>
              <h3 className="text-xl font-black tracking-tight text-[var(--mazzi-text)]">Aula Agendada com Sucesso!</h3>
              <p className="mx-auto max-w-xs text-xs leading-relaxed text-[var(--mazzi-muted)]">
                Sua reserva está confirmada. Você pode acompanhar todos os detalhes na aba de Aulas.
              </p>
              {showTestCopy && <div className="mx-auto inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-[var(--mazzi-yellow-hover)] px-3 py-1.5 text-xs font-bold text-amber-950">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                <span>{checkoutGatewayProvider === 'fake' ? 'Reserva confirmada em ambiente de validação.' : 'Reserva confirmada em ambiente de teste.'}</span>
              </div>}
            </div>

            <div className="space-y-1.5 rounded-2xl border border-amber-100 bg-[var(--mazzi-yellow-hover)]/35 p-4 text-left text-xs">
              <p className="font-extrabold text-[var(--mazzi-text)]">{booking.instructorName || booking.providerName}</p>
              <p className="text-[var(--mazzi-text)]">
                {booking.scheduledStartAt
                  ? `${formatDateBR(booking.scheduledStartAt)} às ${formatTimeBR(booking.scheduledStartAt)}`
                  : `${formatDateBR(booking.scheduledDate)} às ${booking.startTime}`}
              </p>
              <p className="text-[var(--mazzi-muted)]">Ponto de Encontro: {formatMeetingPoint(booking.meetingPoint)}</p>
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


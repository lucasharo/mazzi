import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Building2,
  Car,
  UserCheck,
  Calendar,
  Lock,
  Sparkles,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  Quote,
  Booking,
  Payment,
  PaymentMethodType,
} from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { formatCentsToBRL } from '../../../domain/money';
import { createQuote, isQuoteExpired, QuoteDomainError } from '../../../domain/quote';
import { createBookingHold, BookingDomainError } from '../../../domain/booking';
import { PaymentService } from '../../../domain/payments/payment-service';
import { FakePaymentGateway } from '../../../domain/payments/fake-adapter';
import { useAuth } from '../../../components/auth/AuthContext';
import { supabase } from '../../../lib/supabase';
import { dbService } from '../../../lib/db-service';
import { formatMeetingPoint } from '../../../lib/meeting-point';
import { formatDateBR } from '../../../lib/date-format';
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
  existingBookings?: Booking[];
  onBookingConfirmed: (booking: Booking) => void;
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
  existingBookings = [],
  onBookingConfirmed,
}) => {
  const { user, isAuthenticated, loginAsDemoUser } = useAuth();

  const [step, setStep] = useState<CheckoutStep>('QUOTE_PREVIEW');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

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

  // Reset and generate quote when modal opens or params change
  useEffect(() => {
    if (!isOpen || !provider || !vehicle || !offering) {
      return;
    }

    setErrorMessage(null);
    setBooking(null);
    setPayment(null);
    setStep('QUOTE_PREVIEW');

    const initializeQuote = async () => {
      const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));
      const studentId = user?.id || (isRealSupabase ? 'fee01c74-a968-4035-b11a-c60d6946925f' : 'usr_guest_student');

      try {
        const finalScheduledStartAt = scheduledStartAt || `${scheduledDate}T${startTime}:00.000Z`;
        const idempotencyKey = `idem_quote_${offering.id}_${finalScheduledStartAt}`;

        const isRealSupabase = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offering.id);

        if (isRealSupabase && isUuid) {
          try {
            const rpcRes = await dbService.createQuoteFromOffering(
              offering.id,
              finalScheduledStartAt,
              idempotencyKey
            );

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
            console.error('QUOTE_CREATE_FAILED on real Database:', dbErr);
            if (dbErr?.message?.includes('SELECTED_SLOT_NOT_AVAILABLE')) {
              setStep('ERROR_SLOT_UNAVAILABLE');
            } else {
              setErrorMessage(friendlyCheckoutError(dbErr, 'Não foi possível criar a cotação. Tente novamente.'));
            }
            return;
          }
        }

        // Fallback or mock mode
        const generatedQuote = createQuote({
          studentId,
          provider,
          vehicle,
          offering,
          instructorId: offering.instructorId || provider.id,
          instructorName: offering.instructorName || provider.name,
          scheduledDate,
          startTime,
          endTime,
          scheduledStartAt: finalScheduledStartAt,
          scheduledEndAt: `${scheduledDate}T${endTime}:00.000Z`,
        });
        setQuote(generatedQuote);
        setQuoteTimeRemainingSec(600);
      } catch (err: any) {
        setErrorMessage(friendlyCheckoutError(err, 'Não foi possível gerar a cotação para este horário. Tente novamente.'));
      }
    };

    initializeQuote();
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

  if (!isOpen || !provider || !vehicle || !offering) return null;

  // Step 1: Create Booking Hold (Locks calendar slot temporarily)
  const handleProceedToBookingHold = async () => {
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

      // 1. Local/Domain State Hold
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
      let realPaymentId = `pay_${holdResult.booking.id}`;

      // 2. Real Database Hold (If Supabase is real)
      const isRealSupabase = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');
      if (isRealSupabase) {
        // Defensively validate UUID format to avoid 22P02 invalid input syntax error in PostgreSQL
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.id);
        if (!isUuid) {
          throw new Error('REAL_DATABASE_QUOTE_ID_INVALID');
        }

        try {
          const dbHold = await dbService.createBookingHoldAtMeetingPoint(quote.id, user.id, meetingPoint);
          if (dbHold && dbHold.booking_id) {
            realBookingId = dbHold.booking_id;
          }

          // Call create_booking_payment RPC
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
          console.error('PAYMENT_CREATE_FAILED / Hold failed on real Database:', dbErr);
          // If it fails on slot overlap, propagate it so user sees slot unavailable
          if (dbErr?.message?.includes('SLOT_NO_LONGER_AVAILABLE') || dbErr?.message?.includes('23P01')) {
            throw new BookingDomainError('Este horário já foi reservado por outro aluno.', 'SLOT_NO_LONGER_AVAILABLE');
          }
          throw dbErr;
        }
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

      setPayment({ ...createPayRes.payment, id: realPaymentId });
      setStep('PAYMENT_SELECTION');
    } catch (err: any) {
      if (err instanceof BookingDomainError && err.code === 'SLOT_NO_LONGER_AVAILABLE') {
        setStep('ERROR_SLOT_UNAVAILABLE');
      } else if (err instanceof QuoteDomainError) {
        setStep('ERROR_QUOTE_EXPIRED');
      } else {
        setErrorMessage(friendlyCheckoutError(err, 'Não foi possível reservar este horário no momento. Tente novamente.'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Process Fake Payment Execution (Approved, Declined, or Pending)
  const handleExecuteFakePayment = async (scenario: 'APPROVED' | 'DECLINED' | 'PENDING') => {
    if (!booking || !payment || !user) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (scenario === 'APPROVED') {
        const externalPaymentId = `fake_pay_appr_${Date.now()}`;
        const paidAt = new Date().toISOString();

        // PERSIST IN REAL SUPABASE/POSTGRESQL INSTANCE VIA SECURE DB TRANSACTION (RPC)
        const isRealSupabase = (import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder');
        if (isRealSupabase) {
          try {
            await dbService.confirmBookingPayment(
              payment.id,
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
          payment: { ...payment, method: paymentMethod },
          booking,
          externalPaymentId,
        });

        setBooking(confirmRes.booking);
        setPayment(confirmRes.payment);
        setStep('SUCCESS');
        onBookingConfirmed(confirmRes.booking);
      } else if (scenario === 'DECLINED') {
        const failRes = await paymentService.handlePaymentFailure({
          payment,
          booking,
          reason: 'SIMULATED_DECLINED: Pagamento recusado pelo gateway de testes.',
        });

        setBooking(failRes.booking);
        setPayment(failRes.payment);
        setErrorMessage('Pagamento não aprovado. Tente outro cartão ou selecione PIX.');
      } else if (scenario === 'PENDING') {
        setErrorMessage('Pagamento pendente. Aguardando processamento do gateway.');
      }
    } catch (err: any) {
      setErrorMessage(friendlyCheckoutError(err, 'Não foi possível processar o pagamento simulado. Tente novamente.'));
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'SUCCESS'
          ? 'Reserva Confirmada!'
          : step === 'PAYMENT_SELECTION'
          ? 'Checkout — Pagamento Simulado'
          : 'Resumo da Cotação'
      }
      size="md"
    >
      <div className="space-y-4 text-left">
        {/* Environment Safety Banner */}
        <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 text-amber-900 text-xs font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Ambiente de Desenvolvimento:</strong> Pagamento simulado sem cobrança financeira real.
          </span>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* STEP 1: QUOTE PREVIEW */}
        {step === 'QUOTE_PREVIEW' && quote && (
          <div className="space-y-4">
            {/* Countdown Badge */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-bold">Cotação Válida Por:</span>
              </div>
              <span className="font-mono text-sm font-extrabold text-amber-400">
                {formatCountdown(quoteTimeRemainingSec)}
              </span>
            </div>

            {/* Provider & Schedule Summary */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{provider.name}</span>
                <Badge variant="primary" size="sm">
                  Cat. {offering.category}
                </Badge>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDateBR(scheduledDate)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{startTime} - {endTime} ({offering.durationMinutes} min)</span>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                  <Car className="w-3.5 h-3.5 text-slate-400" />
                  <span>{vehicle.brand} {vehicle.model} ({vehicle.transmission})</span>
                </div>
              </div>
            </div>

            {/* Commercial Price Breakdown */}
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span>Aula Prática ({offering.durationMinutes} min)</span>
                <span className="font-semibold">{formatCentsToBRL(quote.priceInCents)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span>Taxa de Serviço MAZZI</span>
                <span className="font-semibold">{formatCentsToBRL(quote.platformFeeInCents)}</span>
              </div>
              <div className="pt-2 border-t border-amber-300/80 flex items-center justify-between text-sm font-black text-slate-950">
                <span>Total a Pagar</span>
                <span>{formatCentsToBRL(quote.totalInCents)}</span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isProcessing}
              onClick={handleProceedToBookingHold}
              rightIcon={<ShieldCheck className="w-4 h-4" />}
            >
              Confirmar e Reservar Horário
            </Button>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <p className="text-xs font-black text-slate-900">Ponto de encontro</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMeetingPointType('PROVIDER')} className={`p-2 rounded-xl border text-xs font-bold ${meetingPointType === 'PROVIDER' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'}`}>Instrutor / autoescola</button>
                <button type="button" onClick={() => setMeetingPointType('STUDENT')} className={`p-2 rounded-xl border text-xs font-bold ${meetingPointType === 'STUDENT' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white'}`}>Meu endereço</button>
              </div>
              {meetingPointType === 'STUDENT' && <input value={studentAddress} onChange={(event) => setStudentAddress(event.target.value)} placeholder="Digite seu endereço" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" required />}
            </div>
          </div>
        )}

        {/* STEP: AUTH REQUIRED */}
        {step === 'AUTH_REQUIRED' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Identificação Necessária</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Para vincular a reserva com segurança à sua conta, faça login antes de continuar.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-xs font-bold text-slate-700">Entrar como Aluno Demo:</p>
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => {
                  loginAsDemoUser('STUDENT');
                  setStep('QUOTE_PREVIEW');
                }}
              >
                Entrar como Ana Souza (Aluna)
              </Button>
            </div>
          </div>
        )}

        {/* STEP: ERROR SLOT UNAVAILABLE (RACE CONDITION) */}
        {step === 'ERROR_SLOT_UNAVAILABLE' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Esse horário acabou de ficar indisponível</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Outro aluno reservou este horário segundos atrás. Por favor, selecione outro horário disponível no calendário.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => { onClose(); onGoToBookings?.(); }}
            >
              Selecionar Outro Horário
            </Button>
          </div>
        )}

        {/* STEP: ERROR QUOTE EXPIRED */}
        {step === 'ERROR_QUOTE_EXPIRED' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Esta cotação expirou</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                O tempo de garantia de preço e retenção do horário encerrou. Por favor, selecione novamente o horário.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => {
                onClose();
                onGoToBookings?.();
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
            <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Horário Reservado Temporariamente:</span>
              </div>
              <span className="font-mono text-sm font-extrabold text-amber-400">
                {formatCountdown(holdTimeRemainingSec)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                  paymentMethod === 'PIX'
                    ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <QrCode className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">PIX Simulado</span>
                  <span className="text-[10px] text-slate-500">Aprovação instantânea</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="font-bold text-xs text-slate-900 block">Cartão Simulado</span>
                  <span className="text-[10px] text-slate-500">Testar cenários</span>
                </div>
              </button>
            </div>

            {/* PIX Fake View */}
            {paymentMethod === 'PIX' && (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
                <p className="text-xs font-bold text-slate-800">Código PIX Copia e Cola (Simulado)</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600 break-all select-all">
                  {payment.pixQrCode || `FAKE_PIX_SIMULATED_PAYMENT_ENV_DEVELOPMENT_${payment.id}`}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleCopyPixCode}
                  leftIcon={copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copiedPix ? 'Código Copiado!' : 'Copiar Código PIX'}
                </Button>

                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    isLoading={isProcessing}
                    onClick={() => handleExecuteFakePayment('APPROVED')}
                  >
                    Simular Pagamento PIX Aprovado
                  </Button>
                </div>
              </div>
            )}

            {/* Credit Card Fake View */}
            {paymentMethod === 'CREDIT_CARD' && (
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <p className="text-xs font-bold text-slate-800 text-center">
                  Simulador de Testes de Cartão
                </p>

                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    isLoading={isProcessing}
                    onClick={() => handleExecuteFakePayment('APPROVED')}
                    leftIcon={<CheckCircle2 className="w-4 h-4 text-amber-950" />}
                  >
                    Simular Pagamento Aprovado
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    className="w-full text-rose-700 border-rose-200 hover:bg-rose-50"
                    isLoading={isProcessing}
                    onClick={() => handleExecuteFakePayment('DECLINED')}
                    leftIcon={<XCircle className="w-4 h-4 text-rose-600" />}
                  >
                    Simular Pagamento Recusado
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-slate-600"
                    isLoading={isProcessing}
                    onClick={() => handleExecuteFakePayment('PENDING')}
                  >
                    Simular Estado Pendente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === 'SUCCESS' && booking && (
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="font-black text-lg text-slate-900">Aula Agendada com Sucesso!</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                Sua reserva está confirmada. Você pode acompanhar o ponto de encontro e realizar check-in na sua aba de Aulas.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1">
              <p className="font-extrabold text-slate-900">{booking.providerName}</p>
              <p className="text-slate-600">{booking.scheduledDate} às {booking.startTime}</p>
              <p className="text-slate-500">Ponto de Encontro: {formatMeetingPoint(booking.meetingPoint)}</p>
            </div>

            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => {
                onClose();
                onGoToBookings?.();
              }}
            >
              Ver Minhas Aulas
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

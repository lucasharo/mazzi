import { describe, it, expect, beforeEach } from 'vitest';
import {
  performProviderCheckIn,
  startLesson,
  completeLesson,
  LessonSession,
  LESSON_CHECKIN_WINDOW_BEFORE_MINUTES,
  LESSON_CHECKIN_WINDOW_AFTER_MINUTES,
  DEFAULT_DEVELOPMENT_PAYOUT_SAFETY_PERIOD_HOURS,
  LessonSessionDomainError,
} from '../domain/lesson-session';
import { Booking, Vehicle, ServiceOffering, Provider, ComplianceDocument } from '../types';
import { FinancialLedgerService } from '../domain/payments/financial-ledger';
import {
  validateVehicleActivationPermission,
  validateOfferingActivationPermission,
} from '../domain/vehicles-offerings';
import { performProviderCancellation, CancellationDomainError } from '../domain/cancellation';
import { toPublicProviderProfile } from '../domain/providers';
import { approveProvider } from '../domain/provider-lifecycle-service';
import { AuthContext } from '../domain/rbac';

describe('SPRINT 11 — PROVIDER APP JOURNEY & LESSON LIFECYCLE TESTS', () => {
  let mockBooking: Booking;
  let ledger: FinancialLedgerService;

  beforeEach(() => {
    ledger = new FinancialLedgerService();
    mockBooking = {
      id: 'book_prov_test_1',
      studentId: 'usr_student_1',
      studentName: 'Lucas Ferreira',
      providerId: 'prov_1',
      providerName: 'Carlos Alberto Silva',
      instructorId: 'prov_1',
      instructorName: 'Carlos Alberto Silva',
      vehicleId: 'veh_1',
      vehicleName: 'Hyundai HB20 Vision',
      offeringId: 'off_1',
      category: 'B',
      scheduledDate: '2026-08-15',
      startTime: '09:00',
      endTime: '09:50',
      scheduledStartAt: '2026-08-15T09:00:00Z',
      scheduledEndAt: '2026-08-15T09:50:00Z',
      status: 'CONFIRMED',
      studentCheckedIn: false,
      instructorCheckedIn: false,
      meetingPoint: 'Estação Fradique Coutinho do Metrô',
      priceInCents: 9500,
      platformFeeInCents: 950,
      totalInCents: 10450,
      createdAt: '2026-08-14T10:00:00Z',
      updatedAt: '2026-08-14T10:00:00Z',
      snapshot: {
        providerId: 'prov_1',
        providerName: 'Carlos Alberto Silva',
        providerType: 'INSTRUCTOR',
        instructorId: 'prov_1',
        instructorName: 'Carlos Alberto Silva',
        vehicleId: 'veh_1',
        vehicleName: 'Hyundai HB20 Vision',
        category: 'B',
        transmission: 'MANUAL',
        durationMinutes: 50,
        priceInCents: 9500,
        platformFeeInCents: 950,
        totalInCents: 10450,
        meetingPoint: 'Estação Fradique Coutinho do Metrô',
      },
    };
  });

  it('1. Check-in: Executa check-in com sucesso dentro da janela permitida (30min antes do início)', () => {
    const validClock = new Date('2026-08-15T08:40:00Z'); // 20m antes do início
    const result = performProviderCheckIn({
      booking: mockBooking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: validClock,
    });

    expect(result.session.state).toBe('CHECKED_IN');
    expect(result.session.instructorCheckedInAt).toBe(validClock.toISOString());
    expect(result.booking.instructorCheckedIn).toBe(true);
  });

  it('2. Check-in: Rejeita check-in antecipado (> 30min antes)', () => {
    const tooEarlyClock = new Date('2026-08-15T08:00:00Z'); // 60m antes do início
    expect(() =>
      performProviderCheckIn({
        booking: mockBooking,
        providerId: 'prov_1',
        actorUserId: 'usr_instructor_1',
        actorRole: 'INSTRUCTOR',
        now: tooEarlyClock,
      })
    ).toThrowError(/Check-in liberado apenas/);
  });

  it('3. Check-in: Rejeita check-in após expiração da janela (> 60min após término)', () => {
    const expiredClock = new Date('2026-08-15T11:00:00Z'); // 70m após término
    expect(() =>
      performProviderCheckIn({
        booking: mockBooking,
        providerId: 'prov_1',
        actorUserId: 'usr_instructor_1',
        actorRole: 'INSTRUCTOR',
        now: expiredClock,
      })
    ).toThrowError(/Janela de check-in para esta aula foi encerrada/);
  });

  it('4. Check-in: Rejeita chamada vinda de papel não autorizado (STUDENT)', () => {
    const validClock = new Date('2026-08-15T08:45:00Z');
    expect(() =>
      performProviderCheckIn({
        booking: mockBooking,
        providerId: 'prov_1',
        actorUserId: 'usr_student_1',
        actorRole: 'STUDENT',
        now: validClock,
      })
    ).toThrowError(/Somente prestadores de serviço/);
  });

  it('5. Check-in: Rejeita tentativa de outro prestador acessar a aula (Tenant Isolation)', () => {
    const validClock = new Date('2026-08-15T08:45:00Z');
    expect(() =>
      performProviderCheckIn({
        booking: mockBooking,
        providerId: 'prov_outro_2',
        actorUserId: 'usr_instructor_2',
        actorRole: 'INSTRUCTOR',
        now: validClock,
      })
    ).toThrowError(/Acesso negado: esta aula pertence a outro prestador/);
  });

  it('6. Iniciar Aula: Transiciona estado de CHECKED_IN para IN_PROGRESS e atualiza booking.status', () => {
    const validClock = new Date('2026-08-15T08:45:00Z');
    const { session, booking } = performProviderCheckIn({
      booking: mockBooking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: validClock,
    });

    const startClock = new Date('2026-08-15T09:00:00Z');
    const startResult = startLesson({
      session,
      booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: startClock,
    });

    expect(startResult.session.state).toBe('IN_PROGRESS');
    expect(startResult.session.startedAt).toBe(startClock.toISOString());
    expect(startResult.booking.status).toBe('IN_PROGRESS');
  });

  it('7. Finalizar Aula: Transiciona para COMPLETED, gera log de auditoria e grava evento no ledger financeiro', () => {
    const validClock = new Date('2026-08-15T08:45:00Z');
    const checkInResult = performProviderCheckIn({
      booking: mockBooking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: validClock,
    });

    const startClock = new Date('2026-08-15T09:00:00Z');
    const startResult = startLesson({
      session: checkInResult.session,
      booking: checkInResult.booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: startClock,
    });

    const completeClock = new Date('2026-08-15T09:50:00Z');
    const completeResult = completeLesson({
      session: startResult.session,
      booking: startResult.booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      idempotencyKey: 'idem_key_complete_123',
      ledger,
      now: completeClock,
    });

    expect(completeResult.session.state).toBe('COMPLETED');
    expect(completeResult.booking.status).toBe('COMPLETED');
    expect(completeResult.isIdempotent).toBe(false);

    // Verify AuditLog
    expect(completeResult.auditLog.action).toBe('LESSON_COMPLETED');
    expect(completeResult.auditLog.entityId).toBe(mockBooking.id);

    // Verify Ledger event (PAYOUT_HELD with 24h safety period)
    const ledgerEvents = ledger.getEventsForBooking(mockBooking.id);
    expect(ledgerEvents.length).toBe(1);
    expect(ledgerEvents[0].eventType).toBe('PAYOUT_HELD');
    expect(ledgerEvents[0].amountInCents).toBe(mockBooking.totalInCents);
    expect(ledgerEvents[0].platformFeeInCents).toBe(mockBooking.platformFeeInCents);
    expect(ledgerEvents[0].metadata.safetyPeriodHours).toBe(24);
  });

  it('8. Idempotência ao Clicar Duas Vezes em Finalizar Aula', () => {
    const validClock = new Date('2026-08-15T08:45:00Z');
    const checkInResult = performProviderCheckIn({
      booking: mockBooking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: validClock,
    });

    const startClock = new Date('2026-08-15T09:00:00Z');
    const startResult = startLesson({
      session: checkInResult.session,
      booking: checkInResult.booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      now: startClock,
    });

    const completeClock = new Date('2026-08-15T09:50:00Z');
    const firstCall = completeLesson({
      session: startResult.session,
      booking: startResult.booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      idempotencyKey: 'idem_key_double_click_1',
      ledger,
      now: completeClock,
    });

    // Second call with same idempotency key
    const secondCall = completeLesson({
      session: firstCall.session,
      booking: firstCall.booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      idempotencyKey: 'idem_key_double_click_1',
      ledger,
      now: completeClock,
    });

    expect(secondCall.isIdempotent).toBe(true);
    expect(secondCall.session.state).toBe('COMPLETED');
  });

  it('9. Rejeita finalização de aula em reserva que foi cancelada', () => {
    const cancelledBooking: Booking = {
      ...mockBooking,
      status: 'CANCELLED_BY_STUDENT',
    };

    const session: LessonSession = {
      id: `sess_${cancelledBooking.id}`,
      bookingId: cancelledBooking.id,
      providerId: 'prov_1',
      instructorId: 'prov_1',
      studentId: 'usr_student_1',
      state: 'IN_PROGRESS',
      meetingPoint: cancelledBooking.meetingPoint,
      createdAt: '2026-08-14T10:00:00Z',
      updatedAt: '2026-08-14T10:00:00Z',
    };

    expect(() =>
      completeLesson({
        session,
        booking: cancelledBooking,
        providerId: 'prov_1',
        actorUserId: 'usr_instructor_1',
        actorRole: 'INSTRUCTOR',
        now: new Date(),
      })
    ).toThrowError(/Não é possível finalizar uma aula que foi cancelada/);
  });

  it('10. Ativação de Veículo: Impede transição direta DRAFT -> ACTIVE por ação do Provider', () => {
    const draftVehicle: Vehicle = {
      id: 'veh_draft_1',
      providerId: 'prov_1',
      brand: 'Hyundai',
      model: 'HB20',
      year: 2023,
      licensePlate: 'ABC1D23',
      vehicleType: 'CAR',
      category: 'B',
      transmission: 'MANUAL',
      status: 'DRAFT',
      photos: [],
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
    };

    expect(() => validateVehicleActivationPermission(draftVehicle, 'INSTRUCTOR')).toThrowError(
      /Prestadores não podem ativar diretamente um veículo em estado 'DRAFT'/
    );
  });

  it('11. Ativação de Offering: Rejeita se Provider != ACTIVE ou Veículo != ACTIVE', () => {
    const inactiveProvider: Provider = {
      id: 'prov_pending_1',
      userId: 'usr_1',
      name: 'Instructor Pendente',
      legalName: 'Instructor Pendente Silva',
      documentNumber: '123.456.789-00',
      phone: '(11) 99999-9999',
      type: 'INSTRUCTOR',
      status: 'PENDING_REVIEW',
      ratingAverage: 0,
      ratingCount: 0,
      isVerified: false,
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 9000,
      neighborhood: 'Moema',
      city: 'São Paulo',
      state: 'SP',
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
    };

    const activeVehicle: Vehicle = {
      id: 'veh_active_1',
      providerId: 'prov_pending_1',
      brand: 'Hyundai',
      model: 'HB20',
      year: 2023,
      licensePlate: 'ABC1D23',
      vehicleType: 'CAR',
      category: 'B',
      transmission: 'MANUAL',
      status: 'ACTIVE',
      photos: [],
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
    };

    const offering: ServiceOffering = {
      id: 'off_1',
      providerId: 'prov_pending_1',
      vehicleId: 'veh_active_1',
      category: 'B',
      durationMinutes: 50,
      priceInCents: 9500,
      status: 'INACTIVE',
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
    };

    expect(() =>
      validateOfferingActivationPermission(inactiveProvider, activeVehicle, offering, 'INSTRUCTOR')
    ).toThrowError(/Não é possível ativar oferta de serviço para um prestador não ativo/);
  });

  it('12. Cancelamento por Provider: Executa cancelamento e calcula política com idempotência', () => {
    const result = performProviderCancellation({
      booking: mockBooking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      reasonCode: 'SCHEDULE_CONFLICT',
      now: new Date('2026-08-14T12:00:00Z'),
    });

    expect(result.booking.status).toBe('CANCELLED_BY_PROVIDER');
    expect(result.cancellationResult.refundPercentage).toBe(100);
    expect(result.auditLog.action).toBe('BOOKING_CANCELLED_BY_PROVIDER');

    // Idempotent second call
    const result2 = performProviderCancellation({
      booking: result.booking,
      providerId: 'prov_1',
      actorUserId: 'usr_instructor_1',
      actorRole: 'INSTRUCTOR',
      reasonCode: 'SCHEDULE_CONFLICT',
      now: new Date('2026-08-14T12:01:00Z'),
    });

    expect(result2.isIdempotent).toBe(true);
  });

  it('13. Anti Self-Approval Protection: Bloqueia auto-aprovação de cadastro de prestador', () => {
    const provider: Provider = {
      id: 'prov_self_1',
      userId: 'usr_self_1',
      name: 'Prestador Esperto',
      legalName: 'Prestador Esperto Silva',
      documentNumber: '123.456.789-00',
      phone: '(11) 99999-9999',
      type: 'INSTRUCTOR',
      status: 'PENDING_REVIEW',
      ratingAverage: 0,
      ratingCount: 0,
      isVerified: false,
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 9000,
      neighborhood: 'Moema',
      city: 'São Paulo',
      state: 'SP',
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
    };

    const instructorActor: AuthContext = {
      userId: 'usr_self_1',
      email: 'self@mazzi.com.br',
      roles: ['INSTRUCTOR'],
      status: 'ACTIVE',
      providerId: 'prov_self_1',
    };

    expect(() => approveProvider(provider, instructorActor, [])).toThrowError(
      /Operador não possui permissão para aprovar prestadores/
    );
  });

  it('14. Proteção de Dados Pessoais: Sanitização no perfil público do prestador', () => {
    const privateProvider: Provider = {
      id: 'prov_pvt_1',
      userId: 'usr_pvt_1',
      name: 'Nome Publico Exibido',
      legalName: 'Nome Razao Social Culpada E Pessoal',
      documentNumber: '123.456.789-00',
      phone: '(11) 98888-7777', // Telefone pessoal
      publicContact: undefined,
      type: 'INSTRUCTOR',
      status: 'ACTIVE',
      ratingAverage: 4.9,
      ratingCount: 15,
      isVerified: true,
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 9500,
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      createdAt: '2026-08-15T00:00:00Z',
      updatedAt: '2026-08-15T00:00:00Z',
    };

    const publicProfile = toPublicProviderProfile(privateProvider);

    expect(publicProfile.displayName).toBe('Nome Publico Exibido');
    expect((publicProfile as any).phone).toBeUndefined();
    expect((publicProfile as any).legalName).toBeUndefined();
    expect((publicProfile as any).documentNumber).toBeUndefined();
  });
});


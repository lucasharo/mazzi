import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbService, isUuid } from '../src/lib/db-service';
import { supabase } from '../src/lib/supabase';

// Mock Supabase client for service contract verification
vi.mock('../src/lib/supabase', () => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
});

describe('PROVIDER SERVICE CONTRACT TESTS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. saveVehicle Contract', () => {
    it('executes INSERT with new generated UUID when vehicle.id is a draft string (veh_...)', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '11111111-2222-3333-4444-555555555555',
            provider_id: 'prov-123',
            brand: 'Honda',
            model: 'City',
            year: 2024,
            license_plate: 'ABC1D23',
            category: 'B',
            vehicle_type: 'CAR',
            transmission: 'MANUAL',
            status: 'ACTIVE',
          },
          error: null,
        }),
      });

      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ insert: insertMock });

      const result = await dbService.saveVehicle({
        id: 'veh_1771489000_abcde',
        providerId: 'prov-123',
        brand: 'Honda',
        model: 'City',
        year: 2024,
        licensePlate: 'ABC1D23',
        category: 'B',
        vehicleType: 'CAR',
        transmission: 'MANUAL',
        status: 'ACTIVE',
      });

      expect(supabase.from).toHaveBeenCalledWith('vehicles');
      expect(insertMock).toHaveBeenCalled();
      const insertedRow = insertMock.mock.calls[0][0];
      expect(isUuid(insertedRow.id)).toBe(true);
      expect(insertedRow.brand).toBe('Honda');
      expect(result.id).toBe('11111111-2222-3333-4444-555555555555');
    });

    it('executes UPDATE when vehicle.id is a valid UUID', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '11111111-2222-3333-4444-555555555555',
            provider_id: 'prov-123',
            brand: 'Honda',
            model: 'Fit',
            year: 2024,
            license_plate: 'ABC1D23',
            category: 'B',
            vehicle_type: 'CAR',
            transmission: 'MANUAL',
            status: 'ACTIVE',
          },
          error: null,
        }),
      });

      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      const result = await dbService.saveVehicle({
        id: '11111111-2222-3333-4444-555555555555',
        providerId: 'prov-123',
        brand: 'Honda',
        model: 'Fit',
        year: 2024,
        licensePlate: 'ABC1D23',
        category: 'B',
        vehicleType: 'CAR',
        transmission: 'MANUAL',
      });

      expect(supabase.from).toHaveBeenCalledWith('vehicles');
      expect(updateMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('id', '11111111-2222-3333-4444-555555555555');
      expect(result.model).toBe('Fit');
    });

    it('sets status to PENDING for new vehicle when status is undefined', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: '11111111-2222-3333-4444-555555555555', status: 'PENDING' },
          error: null,
        }),
      });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ insert: insertMock });

      await dbService.saveVehicle({
        providerId: 'prov-123',
        brand: 'Toyota',
        model: 'Yaris',
        year: 2024,
        licensePlate: 'XYZ9876',
        category: 'B',
        vehicleType: 'CAR',
        transmission: 'MANUAL',
      });

      const insertedRow = insertMock.mock.calls[0][0];
      expect(insertedRow.status).toBe('PENDING');
      expect(insertedRow.has_dual_pedal).toBeUndefined();
    });

    it('omits status and preserves existing status on partial update when status is undefined', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: '11111111-2222-3333-4444-555555555555', status: 'INACTIVE', color: 'Azul' },
          error: null,
        }),
      });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      await dbService.saveVehicle({
        id: '11111111-2222-3333-4444-555555555555',
        color: 'Azul',
      });

      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.status).toBeUndefined();
    });

    it('explicitly sends has_dual_pedal false when passed as false', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: '11111111-2222-3333-4444-555555555555', has_dual_pedal: false },
          error: null,
        }),
      });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      await dbService.saveVehicle({
        id: '11111111-2222-3333-4444-555555555555',
        hasDualPedal: false,
      } as any);

      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.has_dual_pedal).toBe(false);
    });

    it('omits provider_id, photos and renavam on partial vehicle update when undefined', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: '11111111-2222-3333-4444-555555555555', color: 'Verde' },
          error: null,
        }),
      });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      await dbService.saveVehicle({
        id: '11111111-2222-3333-4444-555555555555',
        color: 'Verde',
      });

      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.provider_id).toBeUndefined();
      expect(updatedRow.photos).toBeUndefined();
      expect(updatedRow.renavam).toBeUndefined();
      expect(updatedRow.color).toBe('Verde');
    });
  });

  describe('2. saveOffering Contract', () => {
    it('executes INSERT with new generated UUID when offering.id is draft string (off_...)', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '22222222-3333-4444-5555-666666666666',
            provider_id: 'prov-123',
            vehicle_id: '11111111-2222-3333-4444-555555555555',
            category: 'B',
            transmission: 'MANUAL',
            duration_minutes: 50,
            price_in_cents: 9500,
            status: 'ACTIVE',
            is_active: true,
          },
          error: null,
        }),
      });

      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ insert: insertMock });

      const result = await dbService.saveOffering({
        id: 'off_123456',
        providerId: 'prov-123',
        vehicleId: '11111111-2222-3333-4444-555555555555',
        category: 'B',
        durationMinutes: 50,
        priceInCents: 9500,
        status: 'ACTIVE',
      });

      expect(supabase.from).toHaveBeenCalledWith('service_offerings');
      expect(insertMock).toHaveBeenCalled();
      const insertedRow = insertMock.mock.calls[0][0];
      expect(isUuid(insertedRow.id)).toBe(true);
      expect(insertedRow.price_in_cents).toBe(9500);
      expect(result.id).toBe('22222222-3333-4444-5555-666666666666');
    });

    it('executes TRUE PATCH update on offering without overwriting transmission or status when undefined', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '22222222-3333-4444-5555-666666666666',
            price_in_cents: 12000,
          },
          error: null,
        }),
      });

      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      await dbService.saveOffering({
        id: '22222222-3333-4444-5555-666666666666',
        priceInCents: 12000,
      });

      expect(supabase.from).toHaveBeenCalledWith('service_offerings');
      expect(updateMock).toHaveBeenCalled();
      const updatedRow = updateMock.mock.calls[0][0];
      expect(updatedRow.provider_id).toBeUndefined();
      expect(updatedRow.transmission).toBeUndefined();
      expect(updatedRow.status).toBeUndefined();
      expect(updatedRow.price_in_cents).toBe(12000);
    });
  });

  describe('3. saveAvailabilityRule & saveAvailabilityException Contract', () => {
    it('executes INSERT for draft rule id (rule_...)', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '33333333-4444-5555-6666-777777777777',
            provider_id: 'prov-123',
            day_of_week: 1,
            start_time: '08:00',
            end_time: '12:00',
            timezone: 'America/Sao_Paulo',
            is_active: true,
          },
          error: null,
        }),
      });

      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ insert: insertMock });

      const result = await dbService.saveAvailabilityRule({
        id: 'rule_123',
        providerId: 'prov-123',
        dayOfWeekNumber: 1,
        startTime: '08:00',
        endTime: '12:00',
        isActive: true,
      });

      expect(supabase.from).toHaveBeenCalledWith('availabilities');
      expect(insertMock).toHaveBeenCalled();
      expect(isUuid(insertMock.mock.calls[0][0].id)).toBe(true);
    });

    it('executes INSERT for draft exception id (exc_...)', async () => {
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: '44444444-5555-6666-7777-888888888888',
            provider_id: 'prov-123',
            type: 'BLOCK',
            reason_category: 'PERSONAL',
            reason: 'Folga médica',
            start_at: '2026-08-20T08:00:00.000-03:00',
            end_at: '2026-08-20T12:00:00.000-03:00',
          },
          error: null,
        }),
      });

      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      (supabase.from as any).mockReturnValue({ insert: insertMock });

      const result = await dbService.saveAvailabilityException({
        id: 'exc_456',
        providerId: 'prov-123',
        type: 'BLOCK',
        reasonCategory: 'PERSONAL',
        reason: 'Folga médica',
        startAt: '2026-08-20T08:00:00.000-03:00',
        endAt: '2026-08-20T12:00:00.000-03:00',
      });

      expect(supabase.from).toHaveBeenCalledWith('availability_exceptions');
      expect(insertMock).toHaveBeenCalled();
      expect(isUuid(insertMock.mock.calls[0][0].id)).toBe(true);
    });
  });

  describe('4. updateProviderProfile Contract & Fail-Closed Behavior', () => {
    it('successfully calls update_provider_profile RPC when available', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      await expect(
        dbService.updateProviderProfile('prov-123', {
          name: 'Instrutor Carlos',
          publicContact: '11999998888',
          neighborhood: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          serviceRadiusKm: 10,
          bio: 'Experiente e paciente',
        })
      ).resolves.not.toThrow();

      expect(supabase.rpc).toHaveBeenCalledWith('update_provider_profile', {
        p_provider_id: 'prov-123',
        p_name: 'Instrutor Carlos',
        p_public_contact: '11999998888',
        p_neighborhood: 'Pinheiros',
        p_city: 'São Paulo',
        p_state: 'SP',
        p_service_radius_km: 10,
        p_bio: 'Experiente e paciente',
      });
    });

    it('preserves explicit empty strings and 0 in update_provider_profile RPC payload', async () => {
      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      await dbService.updateProviderProfile('prov-123', {
        name: '',
        publicContact: '',
        city: '',
        state: '',
        serviceRadiusKm: 0,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('update_provider_profile', {
        p_provider_id: 'prov-123',
        p_name: '',
        p_public_contact: '',
        p_neighborhood: null,
        p_city: '',
        p_state: '',
        p_service_radius_km: 0,
        p_bio: null,
      });
    });

    it('fails closed gracefully when update_provider_profile RPC is absent (migration pending)', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.update_provider_profile in the schema cache' },
      });

      await expect(
        dbService.updateProviderProfile('prov-123', {
          name: 'Instrutor Carlos',
        })
      ).rejects.toThrow('Atualização do perfil profissional ainda não está disponível neste ambiente (migração pendente).');
    });
  });

  describe('6. getProviderBookingContextPublic Category B Enforcement', () => {
    it('returns empty array when provider has only Category A offerings (A-only)', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: [
          { offering_id: 'off-a1', category: 'A', price_in_cents: 9000 },
          { offering_id: 'off-a2', category: 'A', price_in_cents: 9500 },
        ],
        error: null,
      });

      const res = await dbService.getProviderBookingContextPublic('prov-123');
      expect(res).toEqual([]);
    });

    it('returns ONLY Category B offerings when provider has mixed Category A+B offerings', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: [
          { offering_id: 'off-a1', category: 'A', price_in_cents: 9000 },
          { offering_id: 'off-b1', category: 'B', price_in_cents: 10000 },
          { offering_id: 'off-b2', category: 'B', price_in_cents: 12000 },
        ],
        error: null,
      });

      const res = await dbService.getProviderBookingContextPublic('prov-123');
      expect(res).toHaveLength(2);
      expect(res.every((item: any) => item.category === 'B')).toBe(true);
      expect(res.map((item: any) => item.offering_id)).toEqual(['off-b1', 'off-b2']);
    });

    it('returns Category B offerings when provider has B-only offerings', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: [
          { offering_id: 'off-b1', category: 'B', price_in_cents: 10000 },
        ],
        error: null,
      });

      const res = await dbService.getProviderBookingContextPublic('prov-123');
      expect(res).toHaveLength(1);
      expect(res[0].offering_id).toBe('off-b1');
    });
  });

  describe('7. TASK-050 — providerCompleteLesson Mandatory Idempotency & Blank Guard Tests', () => {
    it('1. rejects empty, null, undefined or whitespace-only keys locally without invoking RPC', async () => {
      vi.clearAllMocks();

      await expect(dbService.providerCompleteLesson('booking-123', '' as any)).rejects.toThrow(
        'COMPLETION_IDEMPOTENCY_KEY_REQUIRED: A chave de idempotência é obrigatória para concluir a aula.'
      );

      await expect(dbService.providerCompleteLesson('booking-123', '   ' as any)).rejects.toThrow(
        'COMPLETION_IDEMPOTENCY_KEY_REQUIRED'
      );

      await expect(dbService.providerCompleteLesson('booking-123', null as any)).rejects.toThrow(
        'COMPLETION_IDEMPOTENCY_KEY_REQUIRED'
      );

      await expect(dbService.providerCompleteLesson('booking-123', undefined as any)).rejects.toThrow(
        'COMPLETION_IDEMPOTENCY_KEY_REQUIRED'
      );

      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('2. trims valid idempotency key and calls provider_complete_lesson RPC with correct payload', async () => {
      vi.clearAllMocks();
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          is_idempotent: false,
          booking_id: 'booking-123',
          status: 'COMPLETED',
          completed_at: '2026-08-19T19:00:00Z',
          lesson_finished_at: '2026-08-19T19:00:00Z',
        },
        error: null,
      });

      const res = await dbService.providerCompleteLesson('booking-123', '  complete_btn_booking-123  ');

      expect(supabase.rpc).toHaveBeenCalledWith('provider_complete_lesson', {
        p_booking_id: 'booking-123',
        p_idempotency_key: 'complete_btn_booking-123',
      });
      expect(res.status).toBe('COMPLETED');
      expect(res.is_idempotent).toBe(false);
    });

    it('3. returns is_idempotent = true when retry uses exact same key', async () => {
      vi.clearAllMocks();
      (supabase.rpc as any).mockResolvedValue({
        data: {
          success: true,
          is_idempotent: true,
          booking_id: 'booking-123',
          status: 'COMPLETED',
          completed_at: '2026-08-19T19:00:00Z',
          lesson_finished_at: '2026-08-19T19:00:00Z',
          message: 'Aula já concluída.',
        },
        error: null,
      });

      const res = await dbService.providerCompleteLesson('booking-123', 'complete_btn_booking-123');

      expect(res.is_idempotent).toBe(true);
      expect(res.status).toBe('COMPLETED');
    });

    it('4. propagates backend error IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST when key differs', async () => {
      vi.clearAllMocks();
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: A chave de idempotência informada diverge da utilizada na conclusão deste agendamento.',
        },
      });

      await expect(
        dbService.providerCompleteLesson('booking-123', 'different_key_456')
      ).rejects.toEqual({
        code: '23505',
        message: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: A chave de idempotência informada diverge da utilizada na conclusão deste agendamento.',
      });
    });
  });
});

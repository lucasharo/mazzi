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
            duration_minutes: 60,
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
        durationMinutes: 60,
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
});

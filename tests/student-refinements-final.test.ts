import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  STUDENT_BOOKING_HORIZON_DAYS,
  AVAILABILITY_SEARCH_HORIZON_DAYS,
  generateAvailableSlots,
} from '../src/domain/availability';
import {
  STUDENT_BOOKING_HORIZON_DAYS as SEARCH_HORIZON_DAYS,
  AVAILABILITY_SEARCH_HORIZON_DAYS as SEARCH_AVAIL_DAYS,
} from '../src/domain/search';
import {
  MAX_HORIZON_DAYS,
  INITIAL_WINDOW_DAYS,
  LOAD_MORE_DAYS,
  addDays,
  formatDateOnly,
} from '../src/apps/student/components/SlotSelectorModal';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  AvailabilityRule,
  AvailabilityException,
} from '../src/types';

describe('Student Final Refinements: Detalhes Button, Typography & 60-Day Horizon', () => {
  const cardSource = readFileSync('src/components/ui/BookingCard.tsx', 'utf8');
  const buttonSource = readFileSync('src/components/ui/Button.tsx', 'utf8');
  const slotSource = readFileSync('src/apps/student/components/SlotSelectorModal.tsx', 'utf8');
  const studentSource = readFileSync('src/apps/student/StudentApp.tsx', 'utf8');
  const filterSource = readFileSync('src/components/search/FilterDrawer.tsx', 'utf8');

  const mockProvider: Provider = {
    id: 'p-test',
    name: 'Carlos Instrutor',
    type: 'INSTRUCTOR',
    status: 'ACTIVE',
    ratingAverage: 5.0,
    ratingCount: 10,
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
    categories: ['B'],
    transmissions: ['MANUAL'],
    startingPriceInCents: 10000,
    isVerified: true,
  };

  const mockVehicle: Vehicle = {
    id: 'v-test-1',
    providerId: 'p-test',
    category: 'B',
    transmission: 'MANUAL',
    vehicleType: 'CAR',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2022,
    licensePlate: 'ABC1234',
    status: 'ACTIVE',
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOffering: ServiceOffering = {
    id: 'off-test-1',
    providerId: 'p-test',
    vehicleId: 'v-test-1',
    category: 'B',
    transmission: 'MANUAL',
    durationMinutes: 50,
    priceInCents: 10000,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('1. Detalhes in same yellow color as Agendar (PrimaryButton)', () => {
    it('renders Detalhes with PrimaryButton component and comfortable touch target', () => {
      expect(cardSource).toContain('<PrimaryButton');
      expect(cardSource).toContain('min-h-11 px-3.5 text-xs font-bold');
      expect(cardSource).toContain('onClick={() => onViewDetails(booking)}');
      expect(cardSource).toContain('aria-label="Ver detalhes completos da reserva"');
      expect(cardSource).toContain('Detalhes');
    });
  });

  describe('2. Typography Presence Matching Filtros Button Benchmark (font-bold / 700)', () => {
    it('verifies Filtros button benchmark in StudentApp.tsx', () => {
      expect(studentSource).toContain('text-xs font-bold');
      expect(studentSource).toContain('Filtros');
    });

    it('verifies PrimaryButton and SecondaryButton export and structure', () => {
      expect(buttonSource).toContain('export { PrimaryButton }');
      expect(buttonSource).toContain('export { SecondaryButton, WhiteButton }');
      expect(buttonSource).toContain('font-bold rounded-2xl');
    });

    it('verifies filter chips and action buttons have crisp font-bold presence and floating fixed footer', () => {
      expect(filterSource).toContain('font-bold shadow-xs');
      expect(filterSource).toContain('font-semibold hover:border-slate-300');
      expect(filterSource).toContain('Aplicar Filtros');
      expect(filterSource).toContain('Limpar');
      expect(filterSource).toContain('sticky bottom-0 z-[60]');
      expect(filterSource).toContain('<PrimaryButton');
      expect(filterSource).toContain('<SecondaryButton');
    });
  });

  describe('3. 60-Day Moving Scheduling Horizon & Single Source of Truth', () => {
    it('centralizes booking horizon constants at canonical 60 days in availability.ts', () => {
      const searchSource = readFileSync('src/domain/search.ts', 'utf8');
      expect(searchSource).toContain("from './availability'");
      expect(searchSource).toContain('export { STUDENT_BOOKING_HORIZON_DAYS');
      expect(slotSource).toContain("from '../../../domain/availability'");
      expect(slotSource).toContain('export const MAX_HORIZON_DAYS = STUDENT_BOOKING_HORIZON_DAYS;');

      expect(STUDENT_BOOKING_HORIZON_DAYS).toBe(60);
      expect(AVAILABILITY_SEARCH_HORIZON_DAYS).toBe(60);
      expect(SEARCH_HORIZON_DAYS).toBe(60);
      expect(SEARCH_AVAIL_DAYS).toBe(60);
      expect(MAX_HORIZON_DAYS).toBe(60);
      expect(INITIAL_WINDOW_DAYS).toBe(30);
      expect(LOAD_MORE_DAYS).toBe(30);
    });

    it('Scenario A: Provider with availability only in first 10 days produces NO artificial slots after day 10', () => {
      const now = new Date('2026-08-17T06:00:00.000Z');
      const rules: AvailabilityRule[] = [
        {
          id: 'rule-10d',
          providerId: 'p-test',
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '12:00',
          effectiveFrom: '2026-08-17',
          effectiveTo: '2026-08-27', // only 10 days effective
          timezone: 'America/Sao_Paulo',
          isActive: true,
        },
      ];

      const slots = generateAvailableSlots({
        provider: mockProvider,
        offering: mockOffering,
        vehicles: [mockVehicle],
        startDate: '2026-08-17',
        endDate: '2026-10-17',
        availabilityRules: rules,
        exceptions: [],
        existingBookings: [],
        now,
        maxAdvanceDays: 60,
      });

      // All generated slots must fall strictly between Aug 17 and Aug 27
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.date <= '2026-08-27')).toBe(true);
      expect(slots.some((s) => s.date > '2026-08-27')).toBe(false);
    });

    it('Scenario B: Provider with availability for 45 days generates slots up to day 45 without exceeding', () => {
      const now = new Date('2026-08-17T06:00:00.000Z');
      const rules: AvailabilityRule[] = [
        {
          id: 'rule-45d',
          providerId: 'p-test',
          dayOfWeek: 'MONDAY',
          startTime: '08:00',
          endTime: '10:00',
          effectiveFrom: '2026-08-17',
          effectiveTo: '2026-10-01', // 45 days
          timezone: 'America/Sao_Paulo',
          isActive: true,
        },
      ];

      const slots = generateAvailableSlots({
        provider: mockProvider,
        offering: mockOffering,
        vehicles: [mockVehicle],
        startDate: '2026-08-17',
        endDate: '2026-10-17',
        availabilityRules: rules,
        exceptions: [],
        existingBookings: [],
        now,
        maxAdvanceDays: 60,
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.date <= '2026-10-01')).toBe(true);
    });

    it('Scenario C: Recurring rule that could run indefinitely is strictly capped at the 60-day horizon', () => {
      const now = new Date('2026-08-17T06:00:00.000Z');
      const maxAllowedDate = addDays('2026-08-17', 60);

      const recurringRule: AvailabilityRule = {
        id: 'rule-infinite',
        providerId: 'p-test',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '18:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      };

      const slots = generateAvailableSlots({
        provider: mockProvider,
        offering: mockOffering,
        vehicles: [mockVehicle],
        startDate: '2026-08-17',
        endDate: '2026-10-17',
        availabilityRules: [recurringRule],
        exceptions: [],
        existingBookings: [],
        now,
        maxAdvanceDays: 60,
      });

      expect(slots.length).toBeGreaterThan(0);
      // No slot can be generated beyond now + 60 days
      expect(slots.every((s) => s.date <= maxAllowedDate)).toBe(true);
    });

    it('Scenario E & F: BLOCK exception removes slot and AVAILABLE_OVERRIDE adds slot', () => {
      const now = new Date('2026-08-17T06:00:00.000Z');
      const recurringRule: AvailabilityRule = {
        id: 'rule-recur',
        providerId: 'p-test',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      };

      const blockException: AvailabilityException = {
        id: 'exc-block',
        providerId: 'p-test',
        type: 'BLOCK',
        reasonCategory: 'MAINTENANCE',
        startAt: '2026-08-24T08:00:00-03:00',
        endAt: '2026-08-24T10:00:00-03:00',
        reason: 'Manutenção do veículo',
        createdAt: '2026-08-17T00:00:00Z',
      };

      const overrideException: AvailabilityException = {
        id: 'exc-override',
        providerId: 'p-test',
        type: 'AVAILABLE_OVERRIDE',
        reasonCategory: 'OTHER',
        startAt: '2026-08-25T14:00:00-03:00',
        endAt: '2026-08-25T16:00:00-03:00',
        reason: 'Horário extra liberado',
        createdAt: '2026-08-17T00:00:00Z',
      };

      const slots = generateAvailableSlots({
        provider: mockProvider,
        offering: mockOffering,
        vehicles: [mockVehicle],
        startDate: '2026-08-17',
        endDate: '2026-10-17',
        availabilityRules: [recurringRule],
        exceptions: [blockException, overrideException],
        existingBookings: [],
        now,
        maxAdvanceDays: 60,
      });

      // 2026-08-24 was blocked, must have 0 slots
      expect(slots.some((s) => s.date === '2026-08-24')).toBe(false);
      // 2026-08-25 was overridden, must have slot
      expect(slots.some((s) => s.date === '2026-08-25' && s.startTime === '14:00')).toBe(true);
    });

    it('Scenario H: Empty state is rendered when 0 slots exist within the 60-day window', () => {
      expect(slotSource).toContain('Nenhum horário disponível neste período.');
      expect(slotSource).toContain('Você pode consultar os próximos dias abaixo.');
    });

    it('Scenario I & J: Month navigation and solid CTA footer preserved', () => {
      expect(slotSource).toContain('aria-label="Mês anterior"');
      expect(slotSource).toContain('aria-label="Mês seguinte"');
      expect(slotSource).toContain('Confirmar Horário');
      expect(slotSource).toContain('sticky bottom-0');
      expect(slotSource).toContain('bg-white');
    });
  });
});

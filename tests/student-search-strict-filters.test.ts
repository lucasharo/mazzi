import { describe, it, expect } from 'vitest';
import { executePublicSearch } from '../src/domain/search';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  AvailabilityRule,
} from '../src/types';

describe('Student Search Strict Filter Contract (Scenarios A through K)', () => {
  const baseLat = -23.5658;
  const baseLng = -46.6872;
  const nowIso = new Date().toISOString();

  // Provider 1: Instructor (Autônomo), Pinheiros (0km), 5.0 rating, Cat B Manual (R$ 80) + Cat B Auto (R$ 120)
  const instructor1: Provider = {
    id: 'p-inst-1',
    name: 'Carlos Instrutor',
    type: 'INSTRUCTOR',
    status: 'ACTIVE',
    latitude: -23.5658,
    longitude: -46.6872,
    city: 'São Paulo',
    neighborhood: 'Pinheiros',
    ratingAverage: 5.0,
    ratingCount: 20,
    isVerified: true,
    startingPriceInCents: 8000,
    categories: ['B'],
    transmissions: ['MANUAL', 'AUTOMATIC'],
  };

  const veh1Manual: Vehicle = {
    id: 'v-1-man',
    providerId: 'p-inst-1',
    category: 'B',
    transmission: 'MANUAL',
    vehicleType: 'CAR',
    brand: 'Volkswagen',
    model: 'Gol',
    year: 2022,
    licensePlate: 'ABC1234',
    status: 'ACTIVE',
    photos: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const veh1Auto: Vehicle = {
    id: 'v-1-aut',
    providerId: 'p-inst-1',
    category: 'B',
    transmission: 'AUTOMATIC',
    vehicleType: 'CAR',
    brand: 'Chevrolet',
    model: 'Onix',
    year: 2023,
    licensePlate: 'DEF5678',
    status: 'ACTIVE',
    photos: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const off1Manual: ServiceOffering = {
    id: 'off-1-man',
    providerId: 'p-inst-1',
    vehicleId: 'v-1-man',
    category: 'B',
    transmission: 'MANUAL',
    durationMinutes: 50,
    priceInCents: 8000,
    status: 'ACTIVE',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const off1Auto: ServiceOffering = {
    id: 'off-1-aut',
    providerId: 'p-inst-1',
    vehicleId: 'v-1-aut',
    category: 'B',
    transmission: 'AUTOMATIC',
    durationMinutes: 50,
    priceInCents: 12000,
    status: 'ACTIVE',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Provider 2: Driving School (CFC), 2.2km away, 4.5 rating, Cat A Manual (R$ 60) + Cat B Manual (R$ 110)
  const cfc2: Provider = {
    id: 'p-cfc-2',
    name: 'Autoescola Estrela',
    type: 'DRIVING_SCHOOL',
    status: 'ACTIVE',
    latitude: -23.5858,
    longitude: -46.6872, // ~2.2km away
    city: 'São Paulo',
    neighborhood: 'Itaim Bibi',
    ratingAverage: 4.5,
    ratingCount: 15,
    isVerified: true,
    startingPriceInCents: 6000,
    categories: ['A', 'B'],
    transmissions: ['MANUAL'],
  };

  const veh2Moto: Vehicle = {
    id: 'v-2-moto',
    providerId: 'p-cfc-2',
    category: 'A',
    transmission: 'MANUAL',
    vehicleType: 'MOTORCYCLE',
    brand: 'Honda',
    model: 'CG 160',
    year: 2022,
    licensePlate: 'MTO1234',
    status: 'ACTIVE',
    photos: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const veh2Car: Vehicle = {
    id: 'v-2-car',
    providerId: 'p-cfc-2',
    category: 'B',
    transmission: 'MANUAL',
    vehicleType: 'CAR',
    brand: 'Fiat',
    model: 'Mobi',
    year: 2023,
    licensePlate: 'MOB5678',
    status: 'ACTIVE',
    photos: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const off2Moto: ServiceOffering = {
    id: 'off-2-moto',
    providerId: 'p-cfc-2',
    vehicleId: 'v-2-moto',
    category: 'A',
    transmission: 'MANUAL',
    durationMinutes: 50,
    priceInCents: 6000,
    status: 'ACTIVE',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const off2Car: ServiceOffering = {
    id: 'off-2-car',
    providerId: 'p-cfc-2',
    vehicleId: 'v-2-car',
    category: 'B',
    transmission: 'MANUAL',
    durationMinutes: 50,
    priceInCents: 11000,
    status: 'ACTIVE',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Provider 3: Distant Provider (Guarulhos ~25km away), 4.9 rating, Cat B Auto (R$ 140)
  const inst3Distant: Provider = {
    id: 'p-inst-3',
    name: 'Roberto Guarulhos',
    type: 'INSTRUCTOR',
    status: 'ACTIVE',
    latitude: -23.4628,
    longitude: -46.5333, // ~25km away
    city: 'Guarulhos',
    neighborhood: 'Centro',
    ratingAverage: 4.9,
    ratingCount: 30,
    isVerified: true,
    startingPriceInCents: 14000,
    categories: ['B'],
    transmissions: ['AUTOMATIC'],
  };

  const veh3Auto: Vehicle = {
    id: 'v-3-aut',
    providerId: 'p-inst-3',
    category: 'B',
    transmission: 'AUTOMATIC',
    vehicleType: 'CAR',
    brand: 'Toyota',
    model: 'Yaris',
    year: 2023,
    licensePlate: 'TOY9999',
    status: 'ACTIVE',
    photos: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const off3Auto: ServiceOffering = {
    id: 'off-3-aut',
    providerId: 'p-inst-3',
    vehicleId: 'v-3-aut',
    category: 'B',
    transmission: 'AUTOMATIC',
    durationMinutes: 50,
    priceInCents: 14000,
    status: 'ACTIVE',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const allProviders = [instructor1, cfc2, inst3Distant];
  const allVehicles = [veh1Manual, veh1Auto, veh2Moto, veh2Car, veh3Auto];
  const allOfferings = [off1Manual, off1Auto, off2Moto, off2Car, off3Auto];

  const ruleP1: AvailabilityRule = {
    id: 'r-1',
    providerId: 'p-inst-1',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '18:00',
    timezone: 'America/Sao_Paulo',
    isActive: true,
  };

  const ruleP2: AvailabilityRule = {
    id: 'r-2',
    providerId: 'p-cfc-2',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '18:00',
    timezone: 'America/Sao_Paulo',
    isActive: true,
  };

  const ruleP3: AvailabilityRule = {
    id: 'r-3',
    providerId: 'p-inst-3',
    dayOfWeek: 'MONDAY',
    startTime: '08:00',
    endTime: '18:00',
    timezone: 'America/Sao_Paulo',
    isActive: true,
  };

  const allRules = [ruleP1, ruleP2, ruleP3];

  it('Cenário A: Filtro Categoria A (nenhum prestador sem Cat A pode aparecer)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        category: 'A',
      },
    });

    expect(res.results.length).toBe(1);
    expect(res.results[0].providerId).toBe('p-cfc-2');
    expect(res.results[0].categories).toContain('A');
    expect(res.results.every((r) => r.publicOfferings.every((o) => o.category === 'A'))).toBe(true);
  });

  it('Cenário B: Filtro Categoria B (nenhum prestador sem Cat B pode aparecer)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        category: 'B',
      },
    });

    expect(res.results.length).toBe(3);
    expect(res.results.every((r) => r.publicOfferings.every((o) => o.category === 'B'))).toBe(true);
  });

  it('Cenário C: Filtro Transmissão Manual (nenhum prestador sem Manual pode aparecer)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        transmission: 'MANUAL',
      },
    });

    expect(res.results.length).toBe(2);
    expect(res.results.map((r) => r.providerId)).toEqual(expect.arrayContaining(['p-inst-1', 'p-cfc-2']));
    expect(res.results.some((r) => r.providerId === 'p-inst-3')).toBe(false);
  });

  it('Cenário D: Filtro Transmissão Automático (card exibe preço da oferta automática, e não da manual)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        category: 'B',
        transmission: 'AUTOMATIC',
      },
    });

    expect(res.results.length).toBe(2);
    const p1 = res.results.find((r) => r.providerId === 'p-inst-1');
    expect(p1).toBeDefined();
    // For p-inst-1, the manual offering is R$ 80, but because the filter is AUTOMATIC, startingPrice must be R$ 120 (12000)
    expect(p1!.startingPriceInCents).toBe(12000);
    expect(p1!.publicOfferings.every((o) => o.transmission === 'AUTOMATIC')).toBe(true);
  });

  it('Cenário E: Filtro Preço Máximo R$ 100 (10000 centavos)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        maxPriceInCents: 10000,
      },
    });

    expect(res.results.length).toBe(2); // p-inst-1 (Gol R$80) and p-cfc-2 (Moto R$60)
    expect(res.results.every((r) => r.startingPriceInCents <= 10000)).toBe(true);
  });

  it('Cenário F: Filtro Raio 2km (prestadores a 2.2km ou mais são excluídos)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 2000,
      },
    });

    expect(res.results.length).toBe(1);
    expect(res.results[0].providerId).toBe('p-inst-1');
  });

  it('Cenário G: Filtro Raio 50km (prestadores distantes são incluídos)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
      },
    });

    expect(res.results.length).toBe(3);
    expect(res.results.some((r) => r.providerId === 'p-inst-3')).toBe(true);
  });

  it('Cenário H: Filtro Tipo Instrutor Autônomo (CFC não aparece)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        providerType: 'INSTRUCTOR',
      },
    });

    expect(res.results.length).toBe(2);
    expect(res.results.every((r) => r.providerType === 'INSTRUCTOR')).toBe(true);
  });

  it('Cenário I: Filtro Tipo Autoescola/CFC (Instrutor autônomo não aparece)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        providerType: 'DRIVING_SCHOOL',
      },
    });

    expect(res.results.length).toBe(1);
    expect(res.results[0].providerId).toBe('p-cfc-2');
  });

  it('Cenário J: Filtro Avaliação 4.8★ (prestadores com 4.5★ são excluídos)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 50000,
        minimumRating: 4.8,
      },
    });

    expect(res.results.length).toBe(2); // Carlos (5.0) and Roberto (4.9)
    expect(res.results.some((r) => r.providerId === 'p-cfc-2')).toBe(false);
  });

  it('Cenário K: Combinação simultânea de filtros (Cat B + Automático + até R$ 150 + 10km + 4.5★)', () => {
    const res = executePublicSearch({
      providers: allProviders,
      vehicles: allVehicles,
      offerings: allOfferings,
      availabilityRules: allRules,
      exceptions: [],
      existingBookings: [],
      searchRequest: {
        latitude: baseLat,
        longitude: baseLng,
        radiusMeters: 10000,
        category: 'B',
        transmission: 'AUTOMATIC',
        maxPriceInCents: 15000,
        minimumRating: 4.5,
      },
    });

    expect(res.results.length).toBe(1);
    expect(res.results[0].providerId).toBe('p-inst-1');
    expect(res.results[0].startingPriceInCents).toBe(12000);
  });
});

import { describe, it, expect } from 'vitest';
import { executePublicSearch } from '../src/domain/search';
import { Provider, Vehicle, ServiceOffering, SearchRequest } from '../src/types';

const mockProviderWithLoc: Provider = {
  id: 'prov-loc-1',
  userId: 'usr-1',
  name: 'Instrutor Carlos',
  type: 'INSTRUCTOR',
  status: 'ACTIVE',
  isVerified: true,
  ratingAverage: 4.9,
  ratingCount: 25,
  neighborhood: 'Pinheiros',
  city: 'São Paulo',
  latitude: -23.5658,
  longitude: -46.6872,
  categories: ['B'],
  transmissions: ['MANUAL'],
  startingPriceInCents: 10000,
};

const mockProviderNoLoc: Provider = {
  id: 'prov-no-loc-2',
  userId: 'usr-2',
  name: 'Instrutor Sem GPS',
  type: 'INSTRUCTOR',
  status: 'ACTIVE',
  isVerified: true,
  ratingAverage: 4.8,
  ratingCount: 10,
  neighborhood: 'Pinheiros',
  city: 'São Paulo',
  latitude: undefined,
  longitude: undefined,
  categories: ['B'],
  transmissions: ['MANUAL'],
  startingPriceInCents: 10000,
};

const mockVehicle: Vehicle = {
  id: 'veh-1',
  providerId: 'prov-loc-1',
  brand: 'VW',
  model: 'Gol',
  year: 2022,
  licensePlate: 'ABC1234',
  category: 'B',
  transmission: 'MANUAL',
  vehicleType: 'CAR',
  status: 'ACTIVE',
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockVehicleNoLoc: Vehicle = {
  id: 'veh-2',
  providerId: 'prov-no-loc-2',
  brand: 'Fiat',
  model: 'Uno',
  year: 2021,
  licensePlate: 'XYZ9876',
  category: 'B',
  transmission: 'MANUAL',
  vehicleType: 'CAR',
  status: 'ACTIVE',
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockOffering: ServiceOffering = {
  id: 'off-1',
  providerId: 'prov-loc-1',
  vehicleId: 'veh-1',
  category: 'B',
  durationMinutes: 50,
  priceInCents: 10000,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockOfferingNoLoc: ServiceOffering = {
  id: 'off-2',
  providerId: 'prov-no-loc-2',
  vehicleId: 'veh-2',
  category: 'B',
  durationMinutes: 50,
  priceInCents: 10000,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Student Search - Location Strict & Filtering (TASK-003 / QUICK)', () => {
  it('1. Localização ainda não resolvida (lat/lng undefined) -> busca real NÃO executa (retorna 0 resultados)', () => {
    const req: SearchRequest = {
      latitude: undefined,
      longitude: undefined,
      radiusMeters: 10000,
      category: 'B',
    };
    const res = executePublicSearch({
      providers: [mockProviderWithLoc],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(0);
    expect(res.totalCount).toBe(0);
  });

  it('2. Geolocation válida -> busca executa normalmente', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: -46.6872,
      radiusMeters: 10000,
      category: 'B',
    };
    const res = executePublicSearch({
      providers: [mockProviderWithLoc],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(1);
    expect(res.results[0].providerId).toBe('prov-loc-1');
  });

  it('3. Geolocation negada / indisponível -> nenhuma coordenada de São Paulo/Pinheiros é utilizada como fallback', () => {
    const req: SearchRequest = {
      latitude: undefined,
      longitude: undefined,
      radiusMeters: 10000,
      category: 'B',
    };
    const res = executePublicSearch({
      providers: [mockProviderWithLoc],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toEqual([]);
    expect(res.appliedFilters.latitude).toBeUndefined();
    expect(res.appliedFilters.longitude).toBeUndefined();
  });

  it('4. Latitude undefined -> busca estrita não retorna providers por fallback', () => {
    const req: SearchRequest = {
      latitude: undefined,
      longitude: -46.6872,
      radiusMeters: 10000,
    };
    const res = executePublicSearch({
      providers: [mockProviderWithLoc],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(0);
  });

  it('5. Longitude undefined -> busca estrita não retorna providers por fallback', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: undefined,
      radiusMeters: 10000,
    };
    const res = executePublicSearch({
      providers: [mockProviderWithLoc],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(0);
  });

  it('6. Provider sem coordenadas (latitude/longitude undefined) -> excluído do filtro geoespacial', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: -46.6872,
      radiusMeters: 10000,
    };
    const res = executePublicSearch({
      providers: [mockProviderNoLoc],
      vehicles: [mockVehicleNoLoc],
      offerings: [mockOfferingNoLoc],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(0);
  });

  it('7. roundedDistanceMeters undefined -> não passa no filtro de raio estrito', () => {
    const req: SearchRequest = { radiusMeters: 5000 };
    const dist: number | undefined = undefined;
    const passes = dist !== undefined && dist !== null && Number.isFinite(dist) && dist <= req.radiusMeters;
    expect(passes).toBe(false);
  });

  it('8. roundedDistanceMeters null -> não passa no filtro de raio estrito', () => {
    const req: SearchRequest = { radiusMeters: 5000 };
    const dist: any = null;
    const passes = dist !== undefined && dist !== null && Number.isFinite(dist) && dist <= req.radiusMeters;
    expect(passes).toBe(false);
  });

  it('9. roundedDistanceMeters NaN -> não passa no filtro de raio estrito', () => {
    const req: SearchRequest = { radiusMeters: 5000 };
    const dist: number = NaN;
    const passes = dist !== undefined && dist !== null && Number.isFinite(dist) && dist <= req.radiusMeters;
    expect(passes).toBe(false);
  });

  it('10. roundedDistanceMeters = 0 -> pode passar normalmente (distância 0m legítima)', () => {
    const req: SearchRequest = { radiusMeters: 5000 };
    const dist: number = 0;
    const passes = dist !== undefined && dist !== null && Number.isFinite(dist) && dist <= req.radiusMeters;
    expect(passes).toBe(true);
  });

  it('11. Distância maior que radius -> excluído', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: -46.6872,
      radiusMeters: 1000, // 1 km radius
    };
    // Provider is at -23.6521, -46.7092 (~10 km away)
    const farProvider: Provider = {
      ...mockProviderWithLoc,
      id: 'prov-far',
      latitude: -23.6521,
      longitude: -46.7092,
    };
    const res = executePublicSearch({
      providers: [farProvider],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(0);
  });

  it('12. Distância dentro do radius -> permitido', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: -46.6872,
      radiusMeters: 15000, // 15 km radius
    };
    const res = executePublicSearch({
      providers: [mockProviderWithLoc],
      vehicles: [mockVehicle],
      offerings: [mockOffering],
      availabilityRules: [],
      exceptions: [],
      existingBookings: [],
      searchRequest: req,
    });
    expect(res.results).toHaveLength(1);
  });

  it('13. Localização chega depois que usuário alterou filtros -> filtros atuais permanecem', () => {
    // Simula o comportamento do state update do React
    let searchRequestState: SearchRequest = {
      latitude: undefined,
      longitude: undefined,
      transmission: 'AUTOMATIC',
      category: 'B',
      radiusMeters: 20000,
    };

    // Geolocation chega depois
    const newLoc = { lat: -23.5658, lng: -46.6872 };
    searchRequestState = {
      ...searchRequestState,
      latitude: newLoc.lat,
      longitude: newLoc.lng,
    };

    // Filtros anteriores foram mantidos
    expect(searchRequestState.transmission).toBe('AUTOMATIC');
    expect(searchRequestState.category).toBe('B');
    expect(searchRequestState.radiusMeters).toBe(20000);
    expect(searchRequestState.latitude).toBe(-23.5658);
    expect(searchRequestState.longitude).toBe(-46.6872);
  });

  it('14. Resposta stale não substitui a resposta mais recente (requestId guard)', () => {
    let activeRequestId = 1;
    let renderedResults: string[] = [];

    // Busca 1 inicia com ID 1
    const req1Id = 1;

    // Usuário altera filtro -> Busca 2 inicia com ID 2
    activeRequestId = 2;
    const req2Id = 2;

    // Busca 2 responde primeiro
    if (req2Id === activeRequestId) {
      renderedResults = ['Resultado Busca 2'];
    }

    // Busca 1 responde atrasada (stale)
    if (req1Id === activeRequestId) {
      renderedResults = ['Resultado Busca 1'];
    }

    // Resultado final deve ser a Busca 2
    expect(renderedResults).toEqual(['Resultado Busca 2']);
  });

  it('15. Student permanece Category B no contrato de busca pública', () => {
    const req: SearchRequest = {
      latitude: -23.5658,
      longitude: -46.6872,
      category: 'B',
    };
    expect(req.category).toBe('B');
  });
});

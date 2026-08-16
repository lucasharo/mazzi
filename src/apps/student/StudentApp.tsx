import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  MapPin,
  Calendar as CalendarIcon,
  Clock,
  Filter,
  CheckCircle2,
  ShieldCheck,
  Building2,
  User,
  SlidersHorizontal,
  MessageSquare,
  Sparkles,
  Map,
  List,
  AlertTriangle,
} from 'lucide-react';
import {
  Provider,
  VehicleCategory,
  TransmissionType,
  ProviderType,
  Booking,
  SearchRequest,
  PublicSearchProviderResult,
  SearchResultResponse,
  Vehicle,
  ServiceOffering,
} from '../../types';
import { MOCK_PROVIDERS, MOCK_BOOKINGS, MOCK_VEHICLES, MOCK_OFFERINGS } from '../../data/mockData';
import { BookingCard } from '../../components/ui/BookingCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Price } from '../../components/ui/Price';
import { formatCentsToBRL } from '../../domain/money';
import { UniversalMap } from '../../components/maps/UniversalMap';
import { DEFAULT_SEARCH_RADIUS_METERS, executePublicSearch } from '../../domain/search';
import { SearchHeader } from '../../components/search/SearchHeader';
import { FilterDrawer } from '../../components/search/FilterDrawer';
import { ProviderResultCard } from '../../components/search/ProviderResultCard';
import { MapView } from '../../components/search/MapView';
import { ProviderPublicProfileModal } from '../../components/search/ProviderPublicProfileModal';
import { BookingDetailsModal } from './components/BookingDetailsModal';
import { CheckoutModal } from './components/CheckoutModal';
import { SlotSelectorModal } from './components/SlotSelectorModal';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import { BookingChatPanel } from '../../components/chat/BookingChatPanel';
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { ReviewModal } from '../../components/reviews/ReviewModal';
import { formatDateBR } from '../../lib/date-format';
import { countAdditionalStudentFilters, formatStudentResultCount } from '../../lib/student-search-ui';

function mapPublicResultToProvider(result: PublicSearchProviderResult): Provider {
  return {
    id: result.providerId,
    name: result.displayName,
    type: result.providerType,
    status: result.isVerified ? 'ACTIVE' : 'PENDING_REVIEW',
    ratingAverage: result.ratingAverage,
    ratingCount: result.ratingCount,
    neighborhood: result.neighborhood,
    city: result.city,
    categories: result.categories,
    transmissions: result.transmissions,
    startingPriceInCents: result.startingPriceInCents,
    avatarUrl: result.avatarUrl,
    latitude: result.publicMapLocation.latitude,
    longitude: result.publicMapLocation.longitude,
    isVerified: result.isVerified,
  };
}

export const StudentApp: React.FC = () => {
  const { user, isAuthenticated, loginAsDemoUser } = useAuth();
  const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));

  const [activeTab, setActiveTab] = useState<'search' | 'bookings' | 'messages' | 'profile'>('search');
  const [bookingTab, setBookingTab] = useState<'upcoming' | 'history'>('upcoming');
  const [searchLocation, setSearchLocation] = useState('Pinheiros, São Paulo - SP');
  const [searchViewMode, setSearchViewMode] = useState<'list' | 'map'>('list');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Live Supabase database state
  const [dbProviders, setDbProviders] = useState<Provider[]>([]);
  const [dbVehicles, setDbVehicles] = useState<Vehicle[]>([]);
  const [dbOfferings, setDbOfferings] = useState<ServiceOffering[]>([]);
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(isRealSupabase);
  const [searchError, setSearchError] = useState(false);

  // Load state on mount and when user session updates
  useEffect(() => {
    async function loadRealData() {
      try {
        setIsDbLoading(true);
        if (isRealSupabase) {
          setDbProviders([]);
          setDbVehicles([]);
          setDbOfferings([]);
          setConfirmedBookings(await dbService.getBookings());
          return;
        }
        const [p, v, o, b] = await Promise.all([
          dbService.getProviders(),
          dbService.getVehicles(),
          dbService.getOfferings(),
          dbService.getBookings(),
        ]);
        setDbProviders(p.length > 0 ? p : MOCK_PROVIDERS);
        setDbVehicles(v.length > 0 ? v : MOCK_VEHICLES);
        setDbOfferings(o.length > 0 ? o : MOCK_OFFERINGS);
        setConfirmedBookings(b.length > 0 ? b : MOCK_BOOKINGS);
      } catch (err) {
        console.error('Failed to load dynamic database states:', err);
        if (isRealSupabase) {
          setDbProviders([]);
          setDbVehicles([]);
          setDbOfferings([]);
          setConfirmedBookings([]);
        } else {
          setDbProviders(MOCK_PROVIDERS);
          setDbVehicles(MOCK_VEHICLES);
          setDbOfferings(MOCK_OFFERINGS);
          setConfirmedBookings(MOCK_BOOKINGS);
        }
      } finally {
        setIsDbLoading(false);
      }
    }
    loadRealData();
  }, [user]);

  // Search Engine Pipeline Request State
  const [searchRequest, setSearchRequest] = useState<SearchRequest>({
    latitude: -23.5505,
    longitude: -46.6333,
    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
    category: 'B',
    providerType: 'ALL',
    transmission: 'ALL',
    sortBy: 'RECOMMENDED',
    page: 1,
    limit: 10,
  });

  const handleUpdateSearch = (updates: Partial<SearchRequest>) => {
    setSearchRequest((prev) => ({
      ...prev,
      ...updates,
      page: updates.page ?? 1,
    }));
  };

  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [realSearchResponse, setRealSearchResponse] = useState<SearchResultResponse | null>(null);

  useEffect(() => {
    if (!isRealSupabase) return;
    let cancelled = false;
    setSearchLoading(true);
    setSearchError(false);
    const timer = window.setTimeout(async () => {
      try {
        const results = await dbService.searchPublicProviderResults({
          userLat: searchRequest.latitude,
          userLng: searchRequest.longitude,
          radiusMeters: searchRequest.radiusMeters,
          category: searchRequest.category,
          providerType: searchRequest.providerType,
          transmission: searchRequest.transmission,
          minRating: searchRequest.minRating,
          maxPriceCents: searchRequest.maxPriceInCents,
          limit: searchRequest.limit,
          offset: ((searchRequest.page || 1) - 1) * (searchRequest.limit || 10),
        });
        if (cancelled) return;
        setRealSearchResponse({
          results,
          totalCount: results.length,
          page: searchRequest.page || 1,
          totalPages: 1,
          hasMore: false,
          appliedFilters: searchRequest,
          executionTimeMs: 0,
        });
        setDbProviders(results.map(mapPublicResultToProvider));
        setSearchLoading(false);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to execute public provider search:', error);
          setSearchError(true);
          setSearchLoading(false);
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isRealSupabase, searchRequest, searchRefreshKey]);

  const defaultSearchRequest: SearchRequest = {
    latitude: searchRequest.latitude,
    longitude: searchRequest.longitude,
    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
    category: 'B',
    providerType: 'ALL',
    transmission: 'ALL',
    sortBy: 'RECOMMENDED',
    page: 1,
    limit: 10,
  };
  const additionalFilterCount = countAdditionalStudentFilters(searchRequest);
  const hasChangedFilters = Boolean(
    additionalFilterCount || searchRequest.category !== 'B' || searchRequest.sortBy !== 'RECOMMENDED'
  );

  useEffect(() => {
    setSearchRequest((prev) => ({
      ...prev,
      latitude: -23.5505,
      longitude: -46.6333,
      radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
      category: 'B',
      providerType: 'ALL',
      transmission: 'ALL',
      page: 1,
      limit: 10,
    }));
  }, [user?.id]);

  // Execute Public Search Engine
  const searchResponse = useMemo(() => {
    if (isRealSupabase) return realSearchResponse;
    const res = executePublicSearch({
      providers: isRealSupabase ? dbProviders : (dbProviders.length > 0 ? dbProviders : MOCK_PROVIDERS),
      vehicles: isRealSupabase ? dbVehicles : (dbVehicles.length > 0 ? dbVehicles : MOCK_VEHICLES),
      offerings: isRealSupabase ? dbOfferings : (dbOfferings.length > 0 ? dbOfferings : MOCK_OFFERINGS),
      availabilityRules: [],
      exceptions: [],
      existingBookings: confirmedBookings,
      searchRequest,
    });

    if ((import.meta as any).env?.DEV) {
      console.debug('[MAZZI_SEARCH_DEBUG]', {
        radiusMeters: searchRequest.radiusMeters,
        category: searchRequest.category,
        providerType: searchRequest.providerType,
        transmission: searchRequest.transmission,
        minimumRating: searchRequest.minimumRating,
        hasMaxPrice: typeof searchRequest.maxPriceInCents === 'number',
        resultCount: res.totalCount,
        renderedCount: res.results.length,
      });
    }
    return res;
  }, [searchRequest, dbProviders, dbVehicles, dbOfferings, confirmedBookings, isRealSupabase, realSearchResponse]);

  // Selected Public Profile View State
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<PublicSearchProviderResult | null>(null);

  // Modal States
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState<Booking | null>(null);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);

  // Checkout Flow Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSlotSelectorOpen, setIsSlotSelectorOpen] = useState(false);
  const [checkoutProvider, setCheckoutProvider] = useState<Provider | null>(null);
  const [checkoutVehicle, setCheckoutVehicle] = useState<Vehicle | null>(null);
  const [checkoutOffering, setCheckoutOffering] = useState<ServiceOffering | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  const handleOpenCheckoutByProviderId = async (providerId: string, _date?: string, slot?: any) => {
    const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));
    
    let rawProv: Provider | undefined;
    let matchingVehicle: Vehicle | undefined;
    let matchingOffering: ServiceOffering | undefined;
    let matchingInstructorName = '';

    if (isRealSupabase) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(providerId)) return;

      rawProv = dbProviders.find((p) => p.id === providerId);
      
      try {
        const bookingContexts = await dbService.getProviderBookingContextPublic(providerId);
        if (!bookingContexts || bookingContexts.length === 0) return;

        const ctx = bookingContexts[0];
        matchingInstructorName = ctx.instructor_name || ctx.instructorName || '';
        matchingOffering = {
          id: ctx.offering_id,
          providerId: ctx.provider_id,
          instructorId: ctx.instructor_id,
          instructorName: matchingInstructorName,
          vehicleId: ctx.vehicle_id,
          category: ctx.category,
          transmission: ctx.transmission || 'MANUAL',
          durationMinutes: ctx.duration_minutes,
          priceInCents: ctx.price_in_cents,
          status: 'ACTIVE',
        } as ServiceOffering;

        matchingVehicle = dbVehicles.find((vehicle) => vehicle.id === ctx.vehicle_id) || {
          id: ctx.vehicle_id,
          providerId: ctx.provider_id,
          brand: ctx.vehicle_brand || 'Veículo',
          model: ctx.vehicle_model || 'do instrutor',
          year: Number(ctx.vehicle_year || new Date().getFullYear()),
          licensePlate: '',
          licensePlateMasked: '',
          category: ctx.category,
          vehicleType: ctx.category === 'A' ? 'MOTORCYCLE' : 'CAR',
          transmission: ctx.vehicle_transmission || ctx.transmission || 'MANUAL',
          status: ctx.vehicle_status || 'ACTIVE',
          color: ctx.vehicle_color || undefined,
          photos: ctx.vehicle_photos || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Vehicle;
      } catch (err) {
        console.error('Error fetching booking context', err);
        return;
      }
    } else {
      rawProv = MOCK_PROVIDERS.find((p) => p.id === providerId);
      if (!rawProv) return;
      matchingVehicle = MOCK_VEHICLES.find((v) => v.providerId === providerId) || MOCK_VEHICLES[0];
      matchingOffering = MOCK_OFFERINGS.find((o) => o.providerId === providerId) || MOCK_OFFERINGS[0];
    }

    setCheckoutProvider(rawProv);
    setCheckoutVehicle(matchingVehicle);
    setCheckoutOffering(matchingOffering);
    setSelectedSlot(slot || null);
    void dbService.trackAnalyticsEvent('CHECKOUT_STARTED', {
      category: matchingOffering?.category,
      transmission: matchingOffering?.transmission,
      provider_type: rawProv?.type,
      has_selected_slot: Boolean(slot),
    }).catch((analyticsError) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[MAZZI Analytics] CHECKOUT_STARTED failed:', analyticsError);
      }
    });
    if (slot) {
      setIsCheckoutOpen(true);
    } else {
      setIsSlotSelectorOpen(true);
    }
  };

  const handleOpenCheckoutByProvider = (provider: Provider) => {
    handleOpenCheckoutByProviderId(provider.id);
  };

  // Filter Bookings for Upcoming vs History
  const upcomingBookings = useMemo(() => {
    return confirmedBookings.filter(
      (b) => b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT' || b.status === 'IN_PROGRESS'
    ).sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime());
  }, [confirmedBookings]);

  const historyBookings = useMemo(() => {
    return confirmedBookings.filter(
      (b) =>
        b.status === 'COMPLETED' ||
        b.status === 'CANCELLED_BY_STUDENT' ||
        b.status === 'CANCELLED_BY_PROVIDER' ||
        b.status === 'EXPIRED' ||
        b.status === 'PAYMENT_FAILED' ||
        b.status === 'NO_SHOW_STUDENT' ||
        b.status === 'NO_SHOW_PROVIDER' ||
        b.status === 'REFUNDED'
    ).sort((a, b) => new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime());
  }, [confirmedBookings]);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-0 sm:py-6 text-slate-900">
      {/* Mobile-Frame Container */}
      <div className="w-full max-w-md sm:max-w-lg bg-white sm:rounded-3xl shadow-xl flex flex-col min-h-screen sm:min-h-[840px] overflow-hidden border border-slate-200">
        {/* Top Header - 99 Inspired Signature */}
        <header className="bg-slate-950 text-white px-5 pt-4 pb-4 border-b border-slate-900 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-base tracking-tighter shadow-xs">
                M
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-white block leading-none">
                  MAZZI
                </span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  Encontre sua próxima aula
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>{searchLocation.split(',')[0] || 'São Paulo'}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto pb-24 text-left">
          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="p-4 space-y-4">
              {/* Search Header */}
              <SearchHeader
                searchRequest={searchRequest}
                onUpdateSearch={handleUpdateSearch}
                onPerformSearch={() => setSearchRefreshKey((value) => value + 1)}
                currentLocationName={searchLocation}
                onLocationResolved={(addr) => setSearchLocation(addr)}
              />

              {/* Subheader Filters & Mode Switcher */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFilterDrawerOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                    <span>Filtros</span>
                  </button>

                  <span className="text-xs font-bold text-slate-600" aria-live="polite">
                    {searchLoading ? 'Buscando profissionais…' : formatStudentResultCount(searchResponse?.totalCount || 0)}
                  </span>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSearchViewMode('list')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      searchViewMode === 'list'
                        ? 'bg-slate-950 text-amber-400 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Lista</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchViewMode('map')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      searchViewMode === 'map'
                        ? 'bg-amber-400 text-slate-950 shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>Mapa</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Filtros rápidos">
                {[
                  { label: 'B', active: searchRequest.category === 'B', onClick: () => handleUpdateSearch({ category: 'B' }) },
                  { label: searchRequest.transmission === 'AUTOMATIC' ? 'Automático' : 'Câmbio', active: searchRequest.transmission === 'AUTOMATIC', onClick: () => handleUpdateSearch({ transmission: searchRequest.transmission === 'AUTOMATIC' ? 'ALL' : 'AUTOMATIC' }) },
                  { label: `Até ${Math.round((searchRequest.radiusMeters || DEFAULT_SEARCH_RADIUS_METERS) / 1000)} km`, active: searchRequest.radiusMeters !== DEFAULT_SEARCH_RADIUS_METERS, onClick: () => handleUpdateSearch({ radiusMeters: searchRequest.radiusMeters === 10000 ? DEFAULT_SEARCH_RADIUS_METERS : 10000 }) },
                  { label: searchRequest.maxPriceInCents ? `Até ${formatCentsToBRL(searchRequest.maxPriceInCents)}` : 'Preço', active: typeof searchRequest.maxPriceInCents === 'number', onClick: () => handleUpdateSearch({ maxPriceInCents: searchRequest.maxPriceInCents ? undefined : 15000 }) },
                ].map((chip) => (
                  <button key={chip.label} type="button" onClick={chip.onClick} aria-pressed={chip.active} className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold ${chip.active ? 'bg-amber-400 border-amber-400 text-slate-950' : 'bg-white border-slate-200 text-slate-600'}`}>
                    {chip.label}
                  </button>
                ))}
                <button type="button" onClick={() => setIsFilterDrawerOpen(true)} className="shrink-0 px-3 py-1.5 rounded-full border border-slate-300 text-xs font-bold text-slate-700">
                  Filtros{additionalFilterCount ? ` (${additionalFilterCount})` : ''}
                </button>
                {hasChangedFilters && (
                  <button type="button" onClick={() => { setSearchRequest(defaultSearchRequest); setSearchRefreshKey((value) => value + 1); }} className="shrink-0 text-xs font-bold text-amber-700 underline">
                    Limpar filtros
                  </button>
                )}
              </div>

              {searchError && (
                <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between gap-3">
                  <span>Não foi possível buscar profissionais agora.</span>
                  <button type="button" onClick={() => setSearchRefreshKey((value) => value + 1)} className="font-bold underline">Tentar novamente</button>
                </div>
              )}

              {/* List vs Map View */}
              {searchViewMode === 'map' ? (
                <div className="space-y-3">
                  <MapView
                    results={searchResponse?.results || []}
                    onSelectProvider={(id) => handleOpenCheckoutByProviderId(id)}
                    height="360px"
                  />
                  <div className="space-y-2">
                    {(searchResponse?.results || []).slice(0, 3).map((res) => (
                      <ProviderResultCard
                        key={res.providerId}
                        result={res}
                        onSelect={(id) => handleOpenCheckoutByProviderId(id)}
                        onViewProfile={() => setSelectedPublicProfile(res)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchLoading ? (
                    <div aria-busy="true" className="space-y-3" aria-label="Carregando resultados">
                      {[1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-36 rounded-2xl bg-slate-100 animate-pulse" />)}
                    </div>
                  ) : searchError ? null : (!searchResponse?.results || searchResponse.results.length === 0) ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                      <p className="text-sm font-bold text-slate-800">Nenhum profissional encontrado com esses filtros.</p>
                      <p className="text-xs text-slate-500 mt-1">Tente aumentar o raio de busca ou remover alguns filtros.</p>
                      <button type="button" onClick={() => setSearchRequest(defaultSearchRequest)} className="mt-3 text-xs font-bold text-amber-700 underline">Limpar filtros</button>
                    </div>
                  ) : (
                    searchResponse.results.map((res) => (
                      <ProviderResultCard
                        key={res.providerId}
                        result={res}
                        onSelect={(id) => handleOpenCheckoutByProviderId(id)}
                        onViewProfile={() => setSelectedPublicProfile(res)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* Filter Drawer */}
              <FilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                searchRequest={searchRequest}
                onApplyFilters={(updated) => handleUpdateSearch(updated)}
                onResetFilters={() =>
                  setSearchRequest({
                    latitude: -23.5505,
                    longitude: -46.6333,
                    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
                    category: 'B',
                    providerType: 'ALL',
                    transmission: 'ALL',
                    sortBy: 'RECOMMENDED',
                    page: 1,
                    limit: 10,
                  })
                }
              />

              {/* Public Profile Modal */}
              <ProviderPublicProfileModal
                isOpen={!!selectedPublicProfile}
                onClose={() => setSelectedPublicProfile(null)}
                result={selectedPublicProfile}
                onSelectSlotToBook={(id, date, slot) => handleOpenCheckoutByProviderId(id, date, slot)}
              />
            </div>
          )}

          {/* BOOKINGS TAB (MINHAS AULAS) */}
          {activeTab === 'bookings' && (
            <div className="p-4 space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Minhas Aulas</h2>
                <p className="text-xs text-slate-500">Histórico de horários, local de encontro e check-in</p>
              </div>

              {/* Filter Tabs: Próximas vs Histórico */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setBookingTab('upcoming')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    bookingTab === 'upcoming'
                      ? 'bg-slate-950 text-amber-400 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Próximas ({upcomingBookings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBookingTab('history')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    bookingTab === 'history'
                      ? 'bg-slate-950 text-amber-400 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Histórico ({historyBookings.length})
                </button>
              </div>

              {/* Upcoming Bookings Section */}
              {bookingTab === 'upcoming' && (
                <div className="space-y-3">
                  {upcomingBookings.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                      <p className="text-sm font-bold text-slate-800">Você não possui aulas agendadas.</p>
                      <p className="text-xs text-slate-500 mt-1">Busque um instrutor ou autoescola e agende seu horário.</p>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setActiveTab('search')}
                      >
                        Buscar Aulas
                      </Button>
                    </div>
                  ) : (
                    upcomingBookings.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onOpenChat={(bookingToChat) => setSelectedBookingForChat(bookingToChat)}
                        onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* History Bookings Section */}
              {bookingTab === 'history' && (
                <div className="space-y-3">
                  {historyBookings.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                      <p className="text-sm font-bold text-slate-800">Nenhum histórico de aula anterior.</p>
                    </div>
                  ) : (
                    historyBookings.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)}
                        onReview={(bookingToReview) => setSelectedBookingForReview(bookingToReview)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            <div className="p-4 space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Mensagens</h2>
                <p className="text-xs text-slate-500">Conversas diretas vinculadas aos seus agendamentos</p>
              </div>

              <NotificationsPanel />

              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {confirmedBookings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Você ainda não tem reservas com chat disponível.
                  </div>
                ) : (
                  confirmedBookings.map((booking) => (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setSelectedBookingForChat(booking)}
                      className="w-full p-4 hover:bg-slate-50 transition cursor-pointer flex items-center gap-3 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center">
                        {(booking.instructorName || booking.providerName || 'MA').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {booking.instructorName || booking.providerName}
                          </h4>
                          <span className="text-[10px] text-slate-400">{booking.scheduledDate}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          Reserva {booking.status} • {booking.startTime}–{booking.endTime}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="p-4 space-y-4">
              <div className="bg-slate-950 text-white p-5 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center">
                    {user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'AN'}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-white">{String(user?.name || 'Ana Souza')}</h3>
                    <p className="text-xs text-amber-400 font-semibold">Aluno Categoria B</p>
                    <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'aluno01@mazzi.com.br'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">Resumo do Aprendizado</h4>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-xl font-black text-slate-900 block">
                      {historyBookings.filter((b) => b.status === 'COMPLETED').length}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">Aulas Concluídas</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <span className="text-xl font-black text-amber-700 block">
                      {upcomingBookings.length}
                    </span>
                    <span className="text-[11px] text-amber-900 font-semibold">Aulas Agendadas</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-700">Alternar Usuário de Teste:</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => loginAsDemoUser('STUDENT')}
                >
                  Recarregar Sessão Aluno Demo
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Tab Bar - 99 Style */}
        <nav aria-label="Navegação principal" className="bg-white border-t border-slate-200 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around fixed sm:sticky bottom-0 left-0 right-0 max-w-md sm:max-w-lg mx-auto z-40">
          {[
            { id: 'search', label: 'Buscar', icon: <Search className="w-5 h-5" /> },
            { id: 'bookings', label: 'Aulas', icon: <CalendarIcon className="w-5 h-5" /> },
            { id: 'messages', label: 'Chat', icon: <MessageSquare className="w-5 h-5" /> },
            { id: 'profile', label: 'Perfil', icon: <User className="w-5 h-5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition cursor-pointer ${
                  isActive
                    ? 'text-amber-600 font-black'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <div className={`p-1 rounded-xl ${isActive ? 'bg-amber-100/80 text-slate-950' : ''}`}>
                  {tab.icon}
                </div>
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={!!selectedBookingForDetails}
        onClose={() => setSelectedBookingForDetails(null)}
        booking={selectedBookingForDetails}
        onOpenChat={() => {
          if (selectedBookingForDetails) {
            setSelectedBookingForChat(selectedBookingForDetails);
          }
          setSelectedBookingForDetails(null);
          setActiveTab('messages');
        }}
      />

      <Modal
        isOpen={!!selectedBookingForChat}
        onClose={() => setSelectedBookingForChat(null)}
        title="Chat da aula"
        size="lg"
      >
        {selectedBookingForChat && <BookingChatPanel booking={selectedBookingForChat} />}
      </Modal>

      <ReviewModal
        isOpen={!!selectedBookingForReview}
        booking={selectedBookingForReview}
        onClose={() => setSelectedBookingForReview(null)}
      />

      {/* Slot Selector Modal */}
      {isSlotSelectorOpen && checkoutOffering && (
        <SlotSelectorModal
          isOpen={isSlotSelectorOpen}
          onClose={() => setIsSlotSelectorOpen(false)}
          offeringId={checkoutOffering.id}
          instructorName={checkoutOffering.instructorName || checkoutProvider?.name}
          vehicleLabel={checkoutVehicle ? `${checkoutVehicle.brand} ${checkoutVehicle.model}` : undefined}
          durationMinutes={checkoutOffering.durationMinutes}
          priceInCents={checkoutOffering.priceInCents}
          onSelect={(slot) => {
            setSelectedSlot(slot);
            setIsSlotSelectorOpen(false);
            setIsCheckoutOpen(true);
          }}
        />
      )}

      {/* Complete Checkout Journey Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        provider={checkoutProvider}
        vehicle={checkoutVehicle}
        offering={checkoutOffering}
        scheduledDate={selectedSlot?.local_date || '2026-09-01'}
        startTime={selectedSlot?.local_start_time?.substring(0, 5) || '10:00'}
        endTime={selectedSlot?.local_end_time?.substring(0, 5) || '10:50'}
        scheduledStartAt={selectedSlot?.slot_start_at}
        existingBookings={confirmedBookings}
        onBookingConfirmed={(newBooking) => {
          setConfirmedBookings([newBooking, ...confirmedBookings]);
        }}
      />
    </div>
  );
};

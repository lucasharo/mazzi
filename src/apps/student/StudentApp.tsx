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
  Bell,
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
import { BookingCard } from '../../components/ui/BookingCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Price } from '../../components/ui/Price';
import { formatCentsToBRL } from '../../domain/money';
import { UniversalMap } from '../../components/maps/UniversalMap';
import { DEFAULT_SEARCH_RADIUS_METERS } from '../../domain/search';
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
import { ProfilePhotoPicker } from '../../components/profile/ProfilePhotoPicker';
import { getMyProfileAvatar } from '../../lib/profile-avatar';

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

function offeringFromBookingContext(ctx: any): ServiceOffering {
  return {
    id: ctx.offering_id,
    providerId: ctx.provider_id,
    instructorId: ctx.instructor_id,
    instructorName: ctx.instructor_name || ctx.instructorName || '',
    vehicleId: ctx.vehicle_id,
    category: ctx.category,
    transmission: ctx.transmission || 'MANUAL',
    durationMinutes: ctx.duration_minutes,
    priceInCents: ctx.price_in_cents,
    status: 'ACTIVE',
  } as ServiceOffering;
}

function vehicleFromBookingContext(ctx: any): Vehicle {
  return {
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
}

export const StudentApp: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));

  const [activeTab, setActiveTab] = useState<'search' | 'bookings' | 'notifications' | 'profile'>('search');
  const [bookingTab, setBookingTab] = useState<'upcoming' | 'history'>('upcoming');
  const [searchLocation, setSearchLocation] = useState('Sua localização');
  const [searchViewMode, setSearchViewMode] = useState<'list' | 'map'>('list');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number; label?: string } | undefined>();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfilePhone(formatPhone(user?.phone || ''));
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
    }
  }, [user?.name, user?.phone, user?.avatarUrl]);

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
        const [p, v, o, b] = await Promise.all([
          dbService.getProviders(),
          dbService.getVehicles(),
          dbService.getOfferings(),
          dbService.getBookings(),
        ]);
        setDbProviders(p);
        setDbVehicles(v);
        setDbOfferings(o);
        setConfirmedBookings(b);
      } catch (err) {
        console.error('Failed to load dynamic database states:', err);
        setDbProviders([]);
        setDbVehicles([]);
        setDbOfferings([]);
        setConfirmedBookings([]);
        setSearchError(true);
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
          minRating: searchRequest.minimumRating,
          maxPriceCents: searchRequest.maxPriceInCents,
          limit: searchRequest.limit,
          offset: ((searchRequest.page || 1) - 1) * (searchRequest.limit || 10),
          date: searchRequest.date,
        });
        if (cancelled) return;
        const sortedResults = [...results].sort((a, b) => {
          if (searchRequest.sortBy === 'PRICE_ASC') return a.startingPriceInCents - b.startingPriceInCents || a.providerId.localeCompare(b.providerId);
          if (searchRequest.sortBy === 'PRICE_DESC') return b.startingPriceInCents - a.startingPriceInCents || a.providerId.localeCompare(b.providerId);
          if (searchRequest.sortBy === 'DISTANCE') return (a.roundedDistanceMeters || 0) - (b.roundedDistanceMeters || 0) || a.providerId.localeCompare(b.providerId);
          if (searchRequest.sortBy === 'RATING') return (b.ratingAverage || 0) - (a.ratingAverage || 0) || a.providerId.localeCompare(b.providerId);
          return 0;
        });
        setRealSearchResponse({
          results: sortedResults,
          totalCount: sortedResults.length,
          page: searchRequest.page || 1,
          totalPages: 1,
          hasMore: false,
          appliedFilters: searchRequest,
          executionTimeMs: 0,
        });
        setDbProviders(sortedResults.map(mapPublicResultToProvider));
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
      latitude: userLocation?.lat ?? prev.latitude,
      longitude: userLocation?.lng ?? prev.longitude,
      radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
      category: 'B',
      providerType: 'ALL',
      transmission: 'ALL',
      page: 1,
      limit: 10,
    }));
  }, [user?.id, userLocation]);

  // Execute Public Search Engine
  const searchResponse = useMemo(() => realSearchResponse, [realSearchResponse]);

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
  const [instructorChoices, setInstructorChoices] = useState<any[]>([]);
  const [instructorPickerProvider, setInstructorPickerProvider] = useState<Provider | null>(null);

  const handleOpenCheckoutByProviderId = async (providerId: string, _date?: string, slot?: any) => {
    const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));
    
    let rawProv: Provider | undefined;
    let matchingVehicle: Vehicle | undefined;
    let matchingOffering: ServiceOffering | undefined;
    let matchingInstructorName = '';

    if (isRealSupabase) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(providerId)) return;

      // In the real flow providers are sourced from the public search RPC. The
      // legacy dbProviders collection can still be empty while that request is
      // being committed, so resolve from the rendered search result as well.
      const publicResult = realSearchResponse?.results.find((result) => result.providerId === providerId);
      rawProv = dbProviders.find((p) => p.id === providerId)
        || (publicResult ? mapPublicResultToProvider(publicResult) : undefined);
      
      try {
        const bookingContexts = await dbService.getProviderBookingContextPublic(providerId);
        if (!bookingContexts || bookingContexts.length === 0) return;

        const ctx = bookingContexts[0];
        matchingInstructorName = ctx.instructor_name || ctx.instructorName || '';
        matchingOffering = offeringFromBookingContext(ctx);
        matchingVehicle = dbVehicles.find((vehicle) => vehicle.id === ctx.vehicle_id) || vehicleFromBookingContext(ctx);
        if (rawProv?.type === 'DRIVING_SCHOOL' && bookingContexts.length > 1) {
          setInstructorChoices(bookingContexts);
          setInstructorPickerProvider(rawProv);
          return;
        }
      } catch (err) {
        console.error('Error fetching booking context', err);
        return;
      }
    } else {
      return;
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
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col overflow-hidden">
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
                currentLocation={userLocation}
                onLocationResolved={(addr, lat, lng) => {
                  setSearchLocation(addr);
                  setSearchedLocation({ lat, lng, label: addr });
                }}
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
                    userLocation={userLocation}
                    searchedLocation={searchedLocation}
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

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="p-4 space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Notificações</h2>
                <p className="text-xs text-slate-500">Alertas de agendamentos, pagamentos e comunicados oficiais</p>
              </div>

              <NotificationsPanel />
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="p-4 space-y-4">
              <div className="bg-slate-950 text-white p-5 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center overflow-hidden">
                    {profileAvatar ? <img src={profileAvatar} alt="Foto do perfil" className="w-full h-full object-cover" /> : (user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'AN')}
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-white">{String(user?.name || 'Nome não informado')}</h3>
                    <p className="text-xs text-amber-400 font-semibold">Aluno</p>
                    <p className="text-xs text-slate-400 mt-0.5">{user?.email || 'E-mail não informado'}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between"><h4 className="font-bold text-slate-900 text-sm">Meu perfil</h4><Button variant="outline" size="sm" onClick={() => setIsEditingProfile((value) => !value)}>{isEditingProfile ? 'Cancelar' : 'Editar'}</Button></div>
                {isEditingProfile ? <div className="space-y-2"><label className="block text-xs font-bold text-slate-600">Foto do perfil</label><ProfilePhotoPicker value={profileAvatar} name={profileName || user?.name} onChange={setProfileAvatar} disabled={profileSaving} /><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nome" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /><input value={profilePhone} onChange={(event) => setProfilePhone(formatPhone(event.target.value))} placeholder="Telefone (11) 99999-9999" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /><p className="text-[10px] text-slate-400">E-mail, papel e identificador são informações chave e não podem ser alterados.</p><Button variant="primary" size="sm" isLoading={profileSaving} onClick={async () => { setProfileSaving(true); setProfileError(null); try { await dbService.updateMyProfile(profileName, profilePhone, profileAvatar); setIsEditingProfile(false); } catch (error: any) { setProfileError(error?.message || 'Não foi possível salvar o perfil.'); } finally { setProfileSaving(false); } }}>Salvar perfil</Button>{profileError && <p className="text-xs text-rose-600">{profileError}</p>}</div> : <p className="text-xs text-slate-600">{profilePhone || 'Telefone não informado'}</p>}
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

              <Button variant="outline" size="md" className="w-full text-rose-700 border-rose-200" onClick={() => { void logout(); }}>Sair</Button>
            </div>
          )}
        </main>

        {/* Bottom Tab Bar - Mobile Optimized 99 Style */}
        <nav aria-label="Navegação principal" className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-md z-40 rounded-[28px] border border-slate-200/90 bg-white/90 px-2 py-2 shadow-[0_12px_36px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex items-center justify-around gap-1">
          {[
            { id: 'search', label: 'Buscar', icon: <Search className="w-5 h-5" /> },
            { id: 'bookings', label: 'Aulas', icon: <CalendarIcon className="w-5 h-5" /> },
            { id: 'notifications', label: 'Notificações', icon: <Bell className="w-5 h-5" /> },
            { id: 'profile', label: 'Perfil', icon: <User className="w-5 h-5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className="flex flex-col items-center justify-center py-1.5 px-3 rounded-[22px] text-slate-500 hover:text-slate-900 font-medium transition cursor-pointer min-w-[64px] min-h-[48px]"
              >
                <div className={`p-1.5 rounded-xl ${isActive ? 'text-amber-500' : ''}`}>
                  {tab.icon}
                </div>
                <span className="text-[10px] mt-0.5">{tab.label}</span>
              </button>
            );
          })}
          </div>
        </nav>

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

      {instructorPickerProvider && (
        <Modal
          isOpen={true}
          onClose={() => { setInstructorPickerProvider(null); setInstructorChoices([]); }}
          title="Escolha o instrutor"
          size="sm"
        >
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Esta autoescola possui mais de um instrutor disponível.</p>
            {instructorChoices.map((ctx) => (
              <button
                key={`${ctx.instructor_id}-${ctx.offering_id}`}
                type="button"
                className="w-full p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-400 text-left"
                onClick={() => {
                  const offering = offeringFromBookingContext(ctx);
                  const vehicle = dbVehicles.find((item) => item.id === ctx.vehicle_id) || vehicleFromBookingContext(ctx);
                  setCheckoutProvider(instructorPickerProvider);
                  setCheckoutVehicle(vehicle);
                  setCheckoutOffering(offering);
                  setSelectedSlot(null);
                  setInstructorPickerProvider(null);
                  setInstructorChoices([]);
                  setIsSlotSelectorOpen(true);
                }}
              >
                <span className="font-bold text-sm text-slate-900">{ctx.instructor_name || ctx.instructorName || 'Instrutor disponível'}</span>
                <span className="block text-xs text-slate-500 mt-1">{ctx.vehicle_brand || 'Veículo'} {ctx.vehicle_model || ''}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

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
          existingBookings={confirmedBookings}
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
        onGoToBookings={() => setActiveTab('bookings')}
      />
    </div>
  );
};


import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Calendar as CalendarIcon,
  User,
  Bell,
  MessageSquare,
  Map,
  List,
} from 'lucide-react';
import {
  Provider,
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
import { formatCentsToBRL } from '../../domain/money';
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
import { formatDateBR, formatTimeBR } from '../../lib/date-format';
import { StatusBadge } from '../../components/ui/StatusBadge';
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

function bookingTimestamp(booking: Booking): number {
  const value = booking.scheduledStartAt || `${booking.scheduledDate || ''}T${booking.startTime || '00:00'}`;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export const StudentApp: React.FC = () => {
  const { user, logout } = useAuth();
  const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));

  const [activeTab, setActiveTab] = useState<'search' | 'bookings' | 'messages' | 'profile'>('search');
  const [bookingTab, setBookingTab] = useState<'upcoming' | 'history'>('upcoming');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchViewMode, setSearchViewMode] = useState<'list' | 'map'>('list');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number; label?: string } | undefined>();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);

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
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [searchLoading, setSearchLoading] = useState(isRealSupabase);
  const [searchError, setSearchError] = useState(false);

  // Bookings are an independent data boundary from the public search pipeline.
  useEffect(() => {
    async function loadBookings() {
      setBookingsLoading(true);
      setBookingsError(null);
      try {
        const bookings = await dbService.getBookings();
        setConfirmedBookings(bookings);
      } catch (err) {
        console.error('Failed to load student bookings:', err);
        setConfirmedBookings([]);
        setBookingsError('Não foi possível carregar suas aulas.');
      } finally {
        setBookingsLoading(false);
      }
    }
    void loadBookings();
  }, [user, bookingsRefreshKey]);

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

    if (isRealSupabase) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(providerId)) return;

      // Providers in the student flow are sourced from the public search RPC.
      const publicResult = realSearchResponse?.results.find((result) => result.providerId === providerId);
      rawProv = publicResult ? mapPublicResultToProvider(publicResult) : undefined;
      
      try {
        const bookingContexts = await dbService.getProviderBookingContextPublic(providerId);
        if (!bookingContexts || bookingContexts.length === 0) return;

        const ctx = bookingContexts[0];
        matchingOffering = offeringFromBookingContext(ctx);
        matchingVehicle = vehicleFromBookingContext(ctx);
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
    ).sort((a, b) => bookingTimestamp(a) - bookingTimestamp(b));
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
    ).sort((a, b) => bookingTimestamp(b) - bookingTimestamp(a));
  }, [confirmedBookings]);

  const chatBookings = useMemo(() => {
    const upcomingStatus = new Set(['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS']);
    return [...confirmedBookings].sort((a, b) => {
      const aUpcoming = upcomingStatus.has(a.status) ? 0 : 1;
      const bUpcoming = upcomingStatus.has(b.status) ? 0 : 1;
      if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
      return aUpcoming === 0 ? bookingTimestamp(a) - bookingTimestamp(b) : bookingTimestamp(b) - bookingTimestamp(a);
    });
  }, [confirmedBookings]);

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-400 text-base font-black tracking-tight text-slate-950 shadow-sm">M</div>
              <div><span className="block text-base font-black tracking-tight text-slate-950">MAZZI</span><span className="hidden text-[10px] font-bold text-slate-500 sm:block">Sua próxima aula começa aqui</span></div>
            </div>
            <button type="button" aria-label="Abrir notificações" onClick={() => setIsNotificationsOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-amber-300 hover:text-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"><Bell className="h-5 w-5" aria-hidden="true" /></button>
          </div>
        </header>

        {/* Content Area */}
        <main className="mx-auto min-h-[calc(100dvh-5rem)] w-full max-w-6xl px-4 pb-32 pt-5 text-left sm:px-6 lg:pb-28">
          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="space-y-5">
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
                onOpenFilters={() => setIsFilterDrawerOpen(true)}
                activeFilterCount={additionalFilterCount}
              />

              <section aria-labelledby="student-results-title" className="mt-8 border-t border-slate-200 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="student-results-title" className="text-sm font-black text-slate-950">Resultados</h2><p className="mt-1 text-xs font-semibold text-slate-600" aria-live="polite">{searchLoading ? 'Buscando profissionais…' : formatStudentResultCount(searchResponse?.totalCount || 0)}</p></div><div aria-label="Modo de visualização" className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"><button type="button" aria-pressed={searchViewMode === 'list'} onClick={() => setSearchViewMode('list')} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${searchViewMode === 'list' ? 'bg-slate-950 text-amber-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><List className="h-3.5 w-3.5" />Lista</button><button type="button" aria-pressed={searchViewMode === 'map'} onClick={() => setSearchViewMode('map')} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${searchViewMode === 'map' ? 'bg-slate-950 text-amber-300 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Map className="h-3.5 w-3.5" />Mapa</button></div></div>
              </section>

              {searchError && (
                  <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
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
                      {[1, 2, 3, 4].map((item) => <div key={item} aria-hidden="true" className="h-44 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="h-12 w-12 animate-pulse rounded-2xl bg-slate-100" /><div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-slate-100" /><div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-100" /></div>)}
                    </div>
                  ) : searchError ? null : (!searchResponse?.results || searchResponse.results.length === 0) ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
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
                    latitude: searchRequest.latitude,
                    longitude: searchRequest.longitude,
                    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
                    category: 'B',
                    providerType: 'ALL',
                    transmission: 'ALL',
                    date: undefined,
                    minimumRating: undefined,
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
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Sua jornada</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Minhas aulas</h2>
                <p className="mt-1 text-sm text-slate-500">Acompanhe seus próximos horários e o histórico.</p>
              </div>

              {/* Filter Tabs: Próximas vs Histórico */}
              <div role="tablist" aria-label="Aulas" className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
                <button
                  role="tab"
                  aria-selected={bookingTab === 'upcoming'}
                  type="button"
                  onClick={() => setBookingTab('upcoming')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    bookingTab === 'upcoming'
                      ? 'bg-slate-950 text-amber-400 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Próximas {!bookingsLoading && `(${upcomingBookings.length})`}
                </button>
                <button
                  role="tab"
                  aria-selected={bookingTab === 'history'}
                  type="button"
                  onClick={() => setBookingTab('history')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    bookingTab === 'history'
                      ? 'bg-slate-950 text-amber-400 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Histórico {!bookingsLoading && `(${historyBookings.length})`}
                </button>
              </div>

              {/* Upcoming Bookings Section */}
              {bookingsError && <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"><p className="text-sm font-black text-rose-800">Não foi possível carregar suas aulas.</p><button type="button" onClick={() => setBookingsRefreshKey((value) => value + 1)} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black text-rose-800 shadow-sm">Tentar novamente</button></div>}
              {bookingsLoading && <div aria-busy="true" aria-label="Carregando suas aulas" className="space-y-3">{[1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-44 animate-pulse rounded-3xl border border-slate-200 bg-white p-5"><div className="h-4 w-1/2 rounded bg-slate-100" /><div className="mt-4 h-3 w-2/3 rounded bg-slate-100" /><div className="mt-6 h-3 w-full rounded bg-slate-100" /><div className="mt-3 h-3 w-4/5 rounded bg-slate-100" /></div>)}</div>}
              {!bookingsError && !bookingsLoading && bookingTab === 'upcoming' && (
                <div className="space-y-3">
                  {upcomingBookings.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                      <p className="text-sm font-bold text-slate-800">Nenhuma aula agendada.</p>
                      <p className="text-xs text-slate-500 mt-1">Encontre um instrutor ou autoescola para marcar sua próxima aula.</p>
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-3"
                        onClick={() => setActiveTab('search')}
                      >
                        Buscar aulas
                      </Button>
                    </div>
                  ) : (
                    upcomingBookings.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        variant="student"
                        onOpenChat={(bookingToChat) => setSelectedBookingForChat(bookingToChat)}
                        onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* History Bookings Section */}
              {!bookingsError && !bookingsLoading && bookingTab === 'history' && (
                <div className="space-y-3">
                  {historyBookings.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
                      <p className="text-sm font-bold text-slate-800">Seu histórico ainda está vazio.</p>
                    </div>
                  ) : (
                    historyBookings.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        variant="student"
                        onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)}
                        onReview={(bookingToReview) => setSelectedBookingForReview(bookingToReview)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* CHAT TAB — conversation access stays scoped to real bookings */}
          {activeTab === 'messages' && (
            <div className="space-y-5">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">Conversas</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Conversas</h2><p className="mt-1 text-sm text-slate-500">Combine detalhes das suas aulas com instrutores e autoescolas.</p></div>
              {bookingsLoading ? <div aria-busy="true" aria-label="Carregando conversas" className="grid gap-3 md:grid-cols-2">{[1, 2, 3].map((item) => <div key={item} aria-hidden="true" className="h-32 animate-pulse rounded-3xl border border-slate-200 bg-white p-4"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="mt-4 h-3 w-1/2 rounded bg-slate-100" /><div className="mt-5 h-8 w-28 rounded-xl bg-slate-100" /></div>)}</div> : bookingsError ? <div role="alert" className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"><p className="text-sm font-black text-rose-800">Não foi possível carregar suas conversas.</p><button type="button" onClick={() => setBookingsRefreshKey((value) => value + 1)} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black text-rose-800 shadow-sm">Tentar novamente</button></div> : confirmedBookings.length === 0 ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm"><MessageSquare className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" /><p className="mt-3 text-sm font-black text-slate-800">Nenhuma conversa disponível.</p><p className="mt-1 text-xs text-slate-500">Quando você agendar uma aula, poderá conversar com o profissional por aqui.</p><Button variant="primary" size="sm" className="mt-4" onClick={() => setActiveTab('search')}>Buscar aulas</Button></div> : <div className="grid gap-3 md:grid-cols-2">{chatBookings.map((booking) => { const start = booking.scheduledStartAt || `${booking.scheduledDate}T${booking.startTime}:00`; const instructor = booking.instructorName || booking.snapshot?.instructorName || 'Aula MAZZI'; const provider = booking.providerName && booking.providerName !== instructor ? booking.providerName : ''; const vehicle = booking.vehicleName || booking.snapshot?.vehicleName; return <article key={booking.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-amber-400">{instructor.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{instructor}</p>{provider && <p className="truncate text-xs font-semibold text-slate-500">{provider}</p>}</div></div><StatusBadge status={booking.status} audience="student" /></div><div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600 sm:grid-cols-2"><span>{formatDateBR(start)} · {formatTimeBR(start)}</span>{vehicle && <span className="truncate">{vehicle}</span>}</div><button type="button" aria-label={`Abrir conversa com ${instructor}`} onClick={() => setSelectedBookingForChat(booking)} className="mt-4 w-full rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-amber-400 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">Abrir conversa</button></article>; })}</div>}
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-amber-100 text-xl font-black text-amber-900">
                      {profileAvatar ? <img src={profileAvatar} alt="Foto do perfil" className="h-full w-full object-cover" /> : (user?.name ? user.name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase() : 'AN')}
                    </div>
                    <div className="min-w-0"><h3 className="truncate text-lg font-black text-slate-950">{profileName || user?.name || 'Nome não informado'}</h3><p className="text-xs font-semibold text-amber-700">Aluno MAZZI</p><p className="mt-0.5 truncate text-xs text-slate-500">{user?.email || 'E-mail não informado'}</p></div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsEditingProfile((value) => !value)}>{isEditingProfile ? 'Cancelar' : 'Editar perfil'}</Button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-sm font-black text-slate-950">Dados do perfil</h4>
                {isEditingProfile ? <div className="mt-4 space-y-4">
                  <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-photo">Foto</label><div id="student-profile-photo"><ProfilePhotoPicker value={profileAvatar} name={profileName || user?.name} onChange={setProfileAvatar} disabled={profileSaving} /></div></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-name">Nome</label><input id="student-profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" /></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-phone">Telefone</label><input id="student-profile-phone" value={profilePhone} onChange={(event) => setProfilePhone(formatPhone(event.target.value))} placeholder="(11) 99999-9999" className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200" /></div>
                  <div><label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-email">E-mail</label><input id="student-profile-email" value={user?.email || ''} readOnly aria-readonly="true" className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" /></div>
                  <p className="text-[11px] text-slate-500">E-mail, papel e identificador são informações protegidas e não podem ser alterados.</p>
                  <Button variant="primary" size="md" className="w-full" isLoading={profileSaving} onClick={async () => { setProfileSaving(true); setProfileError(null); try { await dbService.updateMyProfile(profileName, profilePhone, profileAvatar); setIsEditingProfile(false); } catch (error: any) { if (process.env.NODE_ENV !== 'production') console.error('Failed to save student profile:', error); setProfileError('Não foi possível salvar seu perfil.'); } finally { setProfileSaving(false); } }}>Salvar perfil</Button>
                  {profileError && <p role="alert" className="text-xs font-semibold text-rose-700">{profileError}</p>}
                </div> : <dl className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Telefone</dt><dd className="font-semibold text-slate-900">{profilePhone || 'Não informado'}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-slate-500">E-mail</dt><dd className="truncate font-semibold text-slate-900">{user?.email || 'Não informado'}</dd></div></dl>}
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

              <div className="border-t border-slate-200 pt-4"><Button variant="ghost" size="md" className="w-full text-rose-700 hover:bg-rose-50" onClick={() => { void logout(); }}>Sair</Button></div>
            </div>
          )}
        </main>

        {/* Bottom navigation */}
        <nav aria-label="Navegação principal" className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 rounded-[28px] border border-slate-200/90 bg-white/95 px-2 py-2 shadow-[0_12px_36px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center justify-around gap-1">
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

      <Modal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} title="Notificações" size="md">
        <NotificationsPanel />
      </Modal>

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
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-500">Escolha quem vai acompanhar sua aula na autoescola.</p>
            {instructorChoices.map((ctx) => (
              <button
                key={`${ctx.instructor_id}-${ctx.offering_id}`}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-amber-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                onClick={() => {
                  const offering = offeringFromBookingContext(ctx);
                   const vehicle = vehicleFromBookingContext(ctx);
                  setCheckoutProvider(instructorPickerProvider);
                  setCheckoutVehicle(vehicle);
                  setCheckoutOffering(offering);
                  setSelectedSlot(null);
                  setInstructorPickerProvider(null);
                  setInstructorChoices([]);
                  setIsSlotSelectorOpen(true);
                }}
              >
                <span className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-amber-400">{(ctx.instructor_name || ctx.instructorName || 'Instrutor disponível').split(/\s+/).map((part: string) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-900">{ctx.instructor_name || ctx.instructorName || 'Instrutor disponível'}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-500">{ctx.vehicle_brand || 'Veículo'} {ctx.vehicle_model || ''} · {ctx.vehicle_transmission === 'AUTOMATIC' ? 'Automático' : 'Manual'} · Cat. B</span><span className="mt-1 block text-xs font-bold text-slate-700">{ctx.duration_minutes ? `${ctx.duration_minutes} min` : 'Duração a confirmar'} · {typeof ctx.price_in_cents === 'number' ? formatCentsToBRL(ctx.price_in_cents) : 'Preço a confirmar'}</span></span></span>
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
          transmission={checkoutOffering.transmission}
          onSelect={(slot) => {
            setSelectedSlot(slot);
            setIsSlotSelectorOpen(false);
            setIsCheckoutOpen(true);
          }}
        />
      )}

      {/* Complete Checkout Journey Modal — a real selected slot is required */}
      {isCheckoutOpen && selectedSlot && checkoutProvider && checkoutVehicle && checkoutOffering && <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        provider={checkoutProvider}
        vehicle={checkoutVehicle}
        offering={checkoutOffering}
        scheduledDate={selectedSlot.local_date}
        startTime={selectedSlot.local_start_time.substring(0, 5)}
        endTime={selectedSlot.local_end_time.substring(0, 5)}
        scheduledStartAt={selectedSlot?.slot_start_at}
        existingBookings={confirmedBookings}
        onChooseAnotherSlot={() => {
          setIsCheckoutOpen(false);
          setSelectedSlot(null);
          setIsSlotSelectorOpen(true);
        }}
        onBookingConfirmed={(newBooking) => {
          setConfirmedBookings([newBooking, ...confirmedBookings]);
        }}
        onGoToBookings={() => setActiveTab('bookings')}
      />}
    </div>
  );
};


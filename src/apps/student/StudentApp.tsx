import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Calendar as CalendarIcon, User, UserPen, Pencil, UserRound, MessageSquare, Map as MapIcon, List, SlidersHorizontal, RefreshCw, Clock, CalendarClock, History, ChevronRight, Car, } from 'lucide-react';
import { ContentSkeleton } from '../../components/ui/ContentSkeleton';
import {
  Provider, Booking, SearchRequest, PublicSearchProviderResult, SearchResultResponse, Vehicle, ServiceOffering, } from '../../types';
import { BookingCard } from '../../components/ui/BookingCard';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState';
import { AppPageHeader } from '../../components/ui/AppPageHeader';
import { AppBottomNav } from '../../components/ui/AppBottomNav';
import { AppHomeHeader } from '../../components/ui/AppHomeHeader';
import { Button, PrimaryButton, SecondaryButton, ButtonBase } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { formatCentsToBRL } from '../../domain/money';

import { getBookingEndTimestamp, getStudentBookingSection, isBookingEnded } from '../../domain/booking';
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
import { studentCheckInAndRehydrateBooking } from '../../lib/student-booking-actions';
import { supabase } from '../../lib/supabase';
import { BookingChatPanel } from '../../components/chat/BookingChatPanel';
import { NotificationsPanel } from '../../components/notifications/NotificationsPanel';
import { ReviewModal } from '../../components/reviews/ReviewModal';
import { formatDateBR, formatTimeBR, isBookingTodayInSaoPaulo } from '../../lib/date-format';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { countAdditionalStudentFilters, formatStudentResultCount } from '../../lib/student-search-ui';
import { ProfilePhotoPicker } from '../../components/profile/ProfilePhotoPicker';
import { getMyProfileAvatar } from '../../lib/profile-avatar';
import { maskCpf } from '../../utils/cpf';
import { formatDateMask, formatBirthDateForDisplay, validateBirthDate, toISODateString } from '../../utils/age';
import { useMobileAppRoute } from '../../lib/mobile-app-router';
import { StudentProMigrationCard } from './components/StudentProMigrationCard';

export const MAX_MAP_RESULTS = 50;

export function mergePagedProviderResults(
  previous: PublicSearchProviderResult[],
  incoming: PublicSearchProviderResult[],
  viewMode: 'list' | 'map',
): PublicSearchProviderResult[] {
  const seen = new Set<string>();
  const merged: PublicSearchProviderResult[] = [];
  for (const result of [...previous, ...incoming]) {
    if (seen.has(result.providerId)) continue;
    seen.add(result.providerId);
    merged.push(result);
    if (viewMode === 'map' && merged.length >= MAX_MAP_RESULTS) break;
  }
  return merged;
}

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

export function groupBookingContextsByInstructor(bookingContexts: any[]): any[] {
  const contextsByInstructor = new Map<string, any>();
  for (const context of bookingContexts) {
    const instructorId = context.instructor_id || context.instructorId;
    if (instructorId && !contextsByInstructor.has(instructorId)) {
      contextsByInstructor.set(instructorId, context);
    }
  }
  return Array.from(contextsByInstructor.values());
}

export function groupBookingContextsByVehicle(bookingContexts: any[]): any[] {
  const contextsByVehicle = new Map<string, any>();
  for (const context of bookingContexts) {
    const vehicleId = context.vehicle_id || context.vehicleId || context.offering_id || context.offeringId;
    if (vehicleId && !contextsByVehicle.has(vehicleId)) {
      contextsByVehicle.set(vehicleId, context);
    }
  }
  return Array.from(contextsByVehicle.values());
}

export function uniqueBookingOfferingContexts(bookingContexts: any[]): any[] {
  const contextsByOffering = new Map<string, any>();
  for (const context of bookingContexts) {
    const offeringId = context.offering_id || context.offeringId;
    if (offeringId && !contextsByOffering.has(offeringId)) {
      contextsByOffering.set(offeringId, context);
    }
  }
  return Array.from(contextsByOffering.values());
}

export function filterBookingContextsByInstructor(bookingContexts: any[], instructorId: string): any[] {
  return bookingContexts.filter((context) => (context.instructor_id || context.instructorId) === instructorId);
}

export function isBookingSlotCompatibleWithOffering(slot: any | null | undefined, offeringId: string): boolean {
  if (!slot) return false;
  const slotOfferingId = slot.offering_id || slot.offeringId;
  return Boolean(slotOfferingId && slotOfferingId === offeringId);
}

export const StudentApp: React.FC = () => {
  const { user, logout } = useAuth();
  const isRealSupabase = !!((import.meta as any).env?.VITE_SUPABASE_URL && !(import.meta as any).env?.VITE_SUPABASE_URL.includes('placeholder'));

  const [activeTab, setActiveTab] = useMobileAppRoute<'search' | 'bookings' | 'profile'>('student', 'search', ['search', 'bookings', 'profile']);
  const [bookingTab, setBookingTab] = useState<'confirmed' | 'today' | 'history'>('confirmed');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchViewMode, setSearchViewMode] = useState<'list' | 'map'>('list');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number; label?: string } | undefined>();
  const [locationStatus, setLocationStatus] = useState<'RESOLVING' | 'RESOLVED' | 'UNAVAILABLE'>('RESOLVING');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | undefined>();
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [chatOrigin, setChatOrigin] = useState<'details' | 'list'>('list');
  const [resumeBooking, setResumeBooking] = useState<Booking | null>(null);

  const searchRequestIdRef = useRef(0);
  const searchEndRef = useRef<HTMLDivElement | null>(null);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Re-fetch bookings on window focus / visibilitychange
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        setBookingsRefreshKey((k) => k + 1);
      }
    };
    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);

  // Realtime subscription for current student's bookings
  useEffect(() => {
    if (!user?.id || !isRealSupabase) return;

    const channel = supabase
      .channel(`student_bookings_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `student_id=eq.${user.id}`,
        },
        () => {
          setBookingsRefreshKey((k) => k + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isRealSupabase]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('UNAVAILABLE');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setUserLocation({ lat, lng });
          setLocationStatus('RESOLVED');
        } else {
          setLocationStatus('UNAVAILABLE');
        }
      },
      (error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[MAZZI Search] Geolocation error or denied:', error);
        }
        setLocationStatus('UNAVAILABLE');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfilePhone(formatPhone(user?.phone || ''));
    setProfileBirthDate(formatDateMask(user?.birthDate || ''));
    setProfileAvatar(user?.avatarUrl);
    if (user?.id) {
      void getMyProfileAvatar().then((avatarUrl) => setProfileAvatar(avatarUrl)).catch(() => undefined);
    }
  }, [user?.name, user?.phone, user?.avatarUrl, user?.birthDate]);

  // Bookings are an independent data boundary from the public search pipeline (fetched via dbService.getBookings with RLS).
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());
  const [reviewsEligibilityStatus, setReviewsEligibilityStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [searchLoading, setSearchLoading] = useState(isRealSupabase);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    async function loadBookings() {
      setBookingsLoading(true);
      setBookingsError(null);
      try {
        const bookings = await dbService.getBookings();
        setConfirmedBookings(bookings);
        setSelectedBookingForDetails((selectedBooking) => {
          if (!selectedBooking) return selectedBooking;
          return bookings.find((candidate) => candidate.id === selectedBooking.id) || selectedBooking;
        });

        // Batch load reviewed booking IDs to avoid N+1 queries (fail-closed handling)
        const completedIds = bookings.filter((b) => b.status === 'COMPLETED').map((b) => b.id);
        if (completedIds.length > 0) {
          setReviewsEligibilityStatus('LOADING');
          try {
            const reviewedSet = await dbService.getReviewedBookingIds(completedIds);
            setReviewedBookingIds(reviewedSet);
            setReviewsEligibilityStatus('SUCCESS');
          } catch (reviewErr) {
            console.warn('Failed to batch load reviewed booking IDs (fail-closed):', reviewErr);
            setReviewsEligibilityStatus('ERROR');
          }
        } else {
          setReviewedBookingIds(new Set());
          setReviewsEligibilityStatus('SUCCESS');
        }
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
    latitude: undefined,
    longitude: undefined,
    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
    category: 'B',
    providerType: 'ALL',
    transmission: 'ALL',
    sortBy: 'RECOMMENDED',
    page: 1,
    limit: 10,
  });

  const handleUpdateSearch = (updates: Partial<SearchRequest>) => {
    setSearchLoading(true);
    setSearchRequest((prev) => ({
      ...prev,
      ...updates,
      category: 'B', // Public search in MVP is restricted exclusively to Category B
      page: updates.page ?? 1,
    }));
  };

function applyStrictProviderFilters(
  results: PublicSearchProviderResult[],
  req: SearchRequest,
): PublicSearchProviderResult[] {
  const filtered: PublicSearchProviderResult[] = [];
  // Public search in MVP is restricted to Category B
  const targetCategory = req.category && (req.category as string) !== 'ALL' ? req.category : 'B';

  for (const provider of results) {
    // 1. Provider type match (INSTRUCTOR or DRIVING_SCHOOL)
    if (req.providerType && req.providerType !== 'ALL') {
      if (provider.providerType !== req.providerType) continue;
    }

    // 2. Distance / Radius filter match (strict against undefined/null/NaN)
    if (req.radiusMeters !== undefined && req.radiusMeters > 0) {
      const dist = provider.roundedDistanceMeters;
      if (dist === undefined || dist === null || !Number.isFinite(dist) || dist > req.radiusMeters) continue;
    }

    // 3. Minimum rating filter match
    if (req.minimumRating !== undefined && req.minimumRating > 0) {
      if (!provider.ratingCount || (provider.ratingAverage || 0) < req.minimumRating) continue;
    }

    // 4. Compute matching offerings (strictly enforcing requested category or Category B)
    const allOfferings = provider.publicOfferings || [];
    const matchingOfferings = allOfferings.filter((offering) => {
      // Category match: Enforce target category (default B, exclude Category A from public search)
      if (offering.category !== targetCategory) return false;
      // Transmission match
      if (req.transmission && req.transmission !== 'ALL' && offering.transmission !== req.transmission) return false;
      // Max price match
      if (req.maxPriceInCents !== undefined && offering.priceInCents > req.maxPriceInCents) return false;
      // Min price match
      if (req.minPriceInCents !== undefined && offering.priceInCents < req.minPriceInCents) return false;
      return true;
    });

    // If no matching offerings satisfy the active filters, omit provider completely
    if (matchingOfferings.length === 0) {
      continue;
    }

    // Determine displayed prices and offerings strictly from matching offerings
    const lowestPrice = Math.min(...matchingOfferings.map((o) => o.priceInCents));
    const effectiveCategories = Array.from(new Set(matchingOfferings.map((o) => o.category)));
    const effectiveTransmissions = Array.from(new Set(matchingOfferings.map((o) => o.transmission)));

    filtered.push({
      ...provider,
      publicOfferings: matchingOfferings,
      startingPriceInCents: lowestPrice,
      categories: effectiveCategories,
      transmissions: effectiveTransmissions,
    });
  }

  return filtered;
}

  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [realSearchResponse, setRealSearchResponse] = useState<SearchResultResponse | null>(null);

  useEffect(() => {
    if (!isRealSupabase) return;

    const hasValidLocation =
      searchRequest.latitude !== undefined &&
      searchRequest.longitude !== undefined &&
      Number.isFinite(searchRequest.latitude) &&
      Number.isFinite(searchRequest.longitude) &&
      searchRequest.latitude >= -90 &&
      searchRequest.latitude <= 90 &&
      searchRequest.longitude >= -180 &&
      searchRequest.longitude <= 180;

    if (!hasValidLocation) {
      setRealSearchResponse(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    setSearchError(false);
    const requestedPage = searchRequest.page || 1;
    if (requestedPage === 1) setRealSearchResponse(null);
    const requestId = ++searchRequestIdRef.current;
    const timer = window.setTimeout(async () => {
      try {
        const rawResults = await dbService.searchPublicProviderResults({
          userLat: searchRequest.latitude!,
          userLng: searchRequest.longitude!,
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
        if (requestId !== searchRequestIdRef.current) return;

        // Apply strict multi-filter validation on returned results
        const results = applyStrictProviderFilters(rawResults, searchRequest);

        const sortedResults = [...results].sort((a, b) => {
          if (searchRequest.sortBy === 'PRICE_ASC') return a.startingPriceInCents - b.startingPriceInCents || a.providerId.localeCompare(b.providerId);
          if (searchRequest.sortBy === 'PRICE_DESC') return b.startingPriceInCents - a.startingPriceInCents || a.providerId.localeCompare(b.providerId);
          if (searchRequest.sortBy === 'DISTANCE') return ((a.roundedDistanceMeters ?? Infinity) - (b.roundedDistanceMeters ?? Infinity)) || a.providerId.localeCompare(b.providerId);
          if (searchRequest.sortBy === 'RATING') return (b.ratingAverage || 0) - (a.ratingAverage || 0) || a.providerId.localeCompare(b.providerId);
          return 0;
        });
        const pageSize = searchRequest.limit || 10;
        const previousResults = requestedPage === 1 ? [] : (realSearchResponse?.results || []);
        const mergedResults = mergePagedProviderResults(previousResults, sortedResults, searchViewMode);
        const hasMore = rawResults.length >= pageSize && (searchViewMode !== 'map' || mergedResults.length < MAX_MAP_RESULTS);
        setRealSearchResponse({
          results: mergedResults,
          totalCount: mergedResults.length,
          page: requestedPage,
          totalPages: hasMore ? requestedPage + 1 : requestedPage,
          hasMore,
          appliedFilters: searchRequest,
          executionTimeMs: 0,
        });
        setSearchLoading(false);
      } catch (error) {
        if (requestId === searchRequestIdRef.current) {
          console.error('Failed to execute public provider search:', error);
          setSearchError(true);
          setSearchLoading(false);
        }
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isRealSupabase, searchRequest, searchRefreshKey, searchViewMode]);

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
    const loc = searchedLocation || userLocation;
    if (!loc) return;
    if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng) && loc.lat >= -90 && loc.lat <= 90 && loc.lng >= -180 && loc.lng <= 180) {
      setLocationStatus('RESOLVED');
      setSearchRequest((prev) => {
        if (prev.latitude === loc.lat && prev.longitude === loc.lng) return prev;
        return {
          ...prev,
          latitude: loc.lat,
          longitude: loc.lng,
        };
      });
    }
  }, [userLocation, searchedLocation]);

  // Execute Public Search Engine
  const searchResponse = useMemo(() => realSearchResponse, [realSearchResponse]);

  useEffect(() => {
    const loadedResults = searchResponse?.results?.length || 0;
    const mapAtSafeLimit = searchViewMode === 'map' && loadedResults >= MAX_MAP_RESULTS;
    if (activeTab !== 'search' || !searchResponse?.hasMore || searchLoading || mapAtSafeLimit) return undefined;
    const sentinel = searchEndRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setSearchRequest((previous) => ({ ...previous, page: (previous.page || 1) + 1 }));
    }, { rootMargin: '320px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, searchViewMode, searchLoading, searchResponse?.hasMore, searchResponse?.results?.length]);

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
  const [bookingContextChoices, setBookingContextChoices] = useState<any[]>([]);
  const [offeringPickerProvider, setOfferingPickerProvider] = useState<Provider | null>(null);
  const [offeringPickerSlot, setOfferingPickerSlot] = useState<any | null>(null);
  const [bookingContextsForSelection, setBookingContextsForSelection] = useState<any[]>([]);

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

        setBookingContextsForSelection(bookingContexts);
        const distinctInstructorContexts = groupBookingContextsByInstructor(bookingContexts);
        if (rawProv?.type === 'DRIVING_SCHOOL' && distinctInstructorContexts.length > 1) {
          setInstructorChoices(distinctInstructorContexts);
          setInstructorPickerProvider(rawProv);
          return;
        }

        const instructorId = distinctInstructorContexts[0]?.instructor_id || distinctInstructorContexts[0]?.instructorId;
        const contextsForInstructor = rawProv?.type === 'DRIVING_SCHOOL' && instructorId
          ? filterBookingContextsByInstructor(bookingContexts, instructorId)
          : bookingContexts;
        const distinctOfferings = uniqueBookingOfferingContexts(contextsForInstructor);
        if (distinctOfferings.length > 1) {
          setBookingContextChoices(distinctOfferings);
          setOfferingPickerProvider(rawProv || null);
          setOfferingPickerSlot(slot || null);
          return;
        }

        const ctx = distinctOfferings[0] || contextsForInstructor[0] || bookingContexts[0];
        matchingOffering = offeringFromBookingContext(ctx);
        matchingVehicle = vehicleFromBookingContext(ctx);
        if (slot && !isBookingSlotCompatibleWithOffering(slot, matchingOffering.id)) {
          slot = null;
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

  const openCheckoutForContext = (provider: Provider, ctx: any, slot?: any) => {
    const offering = offeringFromBookingContext(ctx);
    const vehicle = vehicleFromBookingContext(ctx);
    const compatibleSlot = isBookingSlotCompatibleWithOffering(slot, offering.id) ? slot : null;
    setCheckoutProvider(provider);
    setCheckoutVehicle(vehicle);
    setCheckoutOffering(offering);
    setSelectedSlot(compatibleSlot);
    setInstructorPickerProvider(null);
    setInstructorChoices([]);
    setOfferingPickerProvider(null);
    setBookingContextChoices([]);
    setOfferingPickerSlot(null);
    if (compatibleSlot) {
      setIsCheckoutOpen(true);
    } else {
      setIsSlotSelectorOpen(true);
    }
  };

  const handleOpenCheckoutByProvider = (provider: Provider) => {
    handleOpenCheckoutByProviderId(provider.id);
  };

  const [nowMs, setNowMs] = useState(() => Date.now());

  // Automatic transition timer: schedule lightweight re-evaluation at the exact moment the next active lesson ends
  useEffect(() => {
    const futureEnds = confirmedBookings
      .map((b) => getBookingEndTimestamp(b))
      .filter((ts) => ts > Date.now());

    if (futureEnds.length === 0) return;

    const nextEndTs = Math.min(...futureEnds);
    const msUntilNextEnd = Math.max(1000, nextEndTs - Date.now() + 500);

    const timer = setTimeout(() => {
      setNowMs(Date.now());
    }, msUntilNextEnd);

    return () => clearTimeout(timer);
  }, [confirmedBookings, nowMs]);

  // Filter Bookings for Upcoming vs History with strict temporal classification
  const upcomingBookings = useMemo(() => {
    return confirmedBookings
      .filter((b) => {
        if (isBookingEnded(b, nowMs)) return false;
        if (isBookingTodayInSaoPaulo(b)) return false;

        if (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') return true;

        if (b.status === 'PENDING_PAYMENT') {
          const holdValid = b.holdExpiresAt ? new Date(b.holdExpiresAt).getTime() > nowMs : true;
          return holdValid;
        }

        return false;
      })
      .sort((a, b) => bookingTimestamp(a) - bookingTimestamp(b));
  }, [confirmedBookings, nowMs]);

  const confirmedLessonBookings = useMemo(() => {
    return confirmedBookings
      .filter((b) =>
        (b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS' || b.status === 'PENDING_PAYMENT') &&
        !isBookingEnded(b, nowMs),
      )
      .sort((a, b) => bookingTimestamp(a) - bookingTimestamp(b));
  }, [confirmedBookings, nowMs]);

  const historyBookings = useMemo(() => {
    return confirmedBookings
      .filter((b) => getStudentBookingSection(b.status, b) === 'HISTORY' || isBookingEnded(b, nowMs))
      .sort((a, b) => bookingTimestamp(b) - bookingTimestamp(a));
  }, [confirmedBookings, nowMs]);

  const todayBookings = useMemo(
    () => confirmedLessonBookings
      .filter((booking) => isBookingTodayInSaoPaulo(booking))
      .sort((a, b) => bookingTimestamp(a) - bookingTimestamp(b)),
    [confirmedLessonBookings],
  );

  const chatBookings = useMemo(() => {
    const upcomingStatus = new Set(['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS']);
    return [...confirmedBookings].sort((a, b) => {
      const aUpcoming = upcomingStatus.has(a.status) ? 0 : 1;
      const bUpcoming = upcomingStatus.has(b.status) ? 0 : 1;
      if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
      return aUpcoming === 0 ? bookingTimestamp(a) - bookingTimestamp(b) : bookingTimestamp(b) - bookingTimestamp(a);
    });
  }, [confirmedBookings]);

  const handleCancelStudentProfile = () => {
    setProfileName(user?.name || '');
    setProfilePhone(formatPhone(user?.phone || ''));
    setProfileBirthDate(formatDateMask(user?.birthDate || ''));
    setProfileAvatar(user?.avatarUrl);
    setProfileError(null);
    setIsEditingProfile(false);
  };

  const handleSaveStudentProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      if (profileBirthDate && !validateBirthDate(profileBirthDate).valid) {
        setProfileError('Informe uma data de nascimento válida (idade mínima 18 anos).');
        return;
      }
      const isoBirthDate = profileBirthDate ? toISODateString(profileBirthDate) : undefined;
      await dbService.updateMyProfile(profileName, profilePhone, profileAvatar, isoBirthDate);
      setIsEditingProfile(false);
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') console.error('Failed to save student profile:', error);
      setProfileError('Não foi possível salvar seu perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="mazzi-app">
        <main className="mazzi-mobile text-left">
          {/* SEARCH TAB */}
          {activeTab === 'search' && (
            <div className="space-y-7">
              <AppHomeHeader
                eyebrow="Aluno MAZZI"
                eyebrowIcon={<UserRound className="h-3 w-3" aria-hidden="true" />}
                title={`Olá, ${user?.name?.split(' ')[0] || 'aluno'}`}
                subtitle="Encontre sua próxima aula e acompanhe seus agendamentos."
                onOpenNotifications={() => setIsNotificationsOpen(true)}
                onRefresh={() => setSearchRefreshKey((value) => value + 1)}
                isRefreshing={searchLoading}
              />
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
                onLocationCleared={() => {
                  setSearchLocation('');
                  setSearchedLocation(undefined);
                }}
              />

              <section aria-labelledby="student-results-title" className="mt-8">
                <div className="flex items-end justify-between gap-3"><div><h2 id="student-results-title" className="mazzi-section-title">Profissionais próximos</h2><p className="mt-1 text-xs font-semibold text-[var(--mazzi-muted)]" aria-live="polite">{locationStatus === 'RESOLVING' && searchRequest.latitude === undefined ? 'Obtendo sua localização…' : searchLoading ? 'Buscando profissionais…' : formatStudentResultCount(searchResponse?.totalCount || 0)}</p></div><div className="flex items-center gap-2"><ButtonBase type="button" onClick={() => setIsFilterDrawerOpen(true)} className="flex h-11 items-center gap-2 rounded-xl bg-[var(--mazzi-surface-soft)] px-3 text-xs font-bold"><SlidersHorizontal className="h-4 w-4" aria-hidden="true"/>Filtros{additionalFilterCount > 0 ? ` ${additionalFilterCount}` : ''}</ButtonBase><div aria-label="Modo de visualização" className="flex rounded-xl bg-[var(--mazzi-surface-soft)] p-1"><ButtonBase type="button" aria-label="Exibir lista" aria-pressed={searchViewMode === 'list'} onClick={() => setSearchViewMode('list')} className={`grid h-9 w-9 place-items-center rounded-lg ${searchViewMode === 'list' ? 'bg-white shadow-sm' : ''}`}><List className="h-4 w-4"/></ButtonBase><ButtonBase type="button" aria-label="Exibir mapa" aria-pressed={searchViewMode === 'map'} onClick={() => { setSearchViewMode('map'); setSearchRequest((previous) => ({ ...previous, page: 1 })); }} className={`grid h-9 w-9 place-items-center rounded-lg ${searchViewMode === 'map' ? 'bg-white shadow-sm' : ''}`}><MapIcon className="h-4 w-4"/></ButtonBase></div></div></div>
              </section>

              {searchError && (
                  <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <span>Não foi possível buscar profissionais agora.</span>
                  <ButtonBase type="button" onClick={() => setSearchRefreshKey((value) => value + 1)} className="inline-flex items-center gap-1.5 font-bold underline">
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Tentar novamente
                  </ButtonBase>
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
                    {searchLoading && <ContentSkeleton count={2} label="Carregando profissionais no mapa" />}
                    <div ref={searchEndRef} className="h-2" aria-hidden="true" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchLoading && !(searchResponse?.results?.length) || (locationStatus === 'RESOLVING' && searchRequest.latitude === undefined) ? (
                    <ContentSkeleton count={4} label="Carregando profissionais" />
                  ) : searchError ? null : (searchRequest.latitude === undefined || searchRequest.longitude === undefined) ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                      <p className="text-sm font-bold text-slate-800">Informe sua localização para encontrar instrutores próximos.</p>
                      <p className="text-xs text-slate-500 mt-1">Digite seu endereço ou bairro na busca acima para ver os profissionais disponíveis na sua região.</p>
                    </div>
                  ) : (!searchResponse?.results || searchResponse.results.length === 0) ? (
                    <EmptyState
                      title="Nenhum profissional encontrado"
                      description="Tente aumentar o raio de busca ou remover alguns filtros."
                      actionLabel="Limpar filtros"
                      onAction={() => setSearchRequest(defaultSearchRequest)}
                    />
                  ) : (
                    <>
                      {searchResponse.results.map((res) => (
                        <ProviderResultCard
                          key={res.providerId}
                          result={res}
                          onSelect={(id) => handleOpenCheckoutByProviderId(id)}
                          onViewProfile={() => setSelectedPublicProfile(res)}
                        />
                      ))}
                      {searchLoading && <ContentSkeleton count={2} label="Carregando mais instrutores" />}
                      <div ref={searchEndRef} className="h-2" aria-hidden="true" />
                    </>
                  )}
                </div>
              )}

              {/* Filter Drawer */}
              <FilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                filters={searchRequest}
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
              <AppPageHeader
                eyebrow="Sua jornada"
                title="Minhas aulas"
                subtitle="Acompanhe seus próximos horários e o histórico."
                action={<ButtonBase
                  type="button"
                  aria-label="Atualizar lista de aulas"
                  title="Atualizar lista de aulas"
                  onClick={() => setBookingsRefreshKey((k) => k + 1)}
                  className="mazzi-icon-button shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`h-5 w-5 text-slate-700 ${bookingsLoading ? 'animate-spin text-amber-600' : ''}`} aria-hidden="true" />
                </ButtonBase>}
              />

              {/* Filter Tabs */}
              <div role="tablist" aria-label="Aulas" className="grid grid-cols-3 gap-1 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-1">
                <ButtonBase
                  role="tab"
                  aria-selected={bookingTab === 'confirmed'}
                  type="button"
                  onClick={() => setBookingTab('confirmed')}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                    bookingTab === 'confirmed'
                      ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs'
                      : 'text-slate-600 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/50 font-semibold'
                  }`}
                >
                  <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Próximas
                </ButtonBase>
                <ButtonBase
                  role="tab"
                  aria-selected={bookingTab === 'today'}
                  type="button"
                  onClick={() => setBookingTab('today')}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                    bookingTab === 'today'
                      ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs'
                      : 'text-slate-600 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/50 font-semibold'
                  }`}
                >
                  <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Hoje
                </ButtonBase>
                <ButtonBase
                  role="tab"
                  aria-selected={bookingTab === 'history'}
                  type="button"
                  onClick={() => setBookingTab('history')}
                  className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                    bookingTab === 'history'
                      ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-xs'
                      : 'text-slate-600 hover:text-[var(--mazzi-dark)] hover:bg-slate-200/50 font-semibold'
                  }`}
                >
                  <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Histórico
                </ButtonBase>
              </div>

              {/* Confirmed bookings */}
              {bookingsError && <ErrorState message="Não foi possível carregar suas aulas." onRetry={() => setBookingsRefreshKey((value) => value + 1)} />}
              {bookingsLoading && <ContentSkeleton count={3} label="Carregando suas aulas" />}
              {!bookingsError && !bookingsLoading && bookingTab === 'confirmed' && (
                <div className="space-y-3">
                  {upcomingBookings.length === 0 ? (
                    <EmptyState
                      title="Nenhuma aula confirmada"
                      description="Você não possui aulas confirmadas no momento."
                      actionLabel="Buscar aulas"
                      actionIcon={<Search className="h-4 w-4" aria-hidden="true" />}
                      onAction={() => setActiveTab('search')}
                    />
                  ) : (
                    upcomingBookings.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        variant="student"
                        onOpenChat={(bookingToChat) => {
                          setChatOrigin('list');
                          setSelectedBookingForChat(bookingToChat);
                        }}
                        onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)}
                      />
                    ))
                  )}
                </div>
              )}

              {!bookingsError && !bookingsLoading && bookingTab === 'today' && (
                <div className="space-y-3">
                  {todayBookings.length === 0 ? (
                    <EmptyState title="Nenhuma aula para hoje" description="Suas aulas de hoje aparecerão aqui." />
                  ) : (
                    todayBookings.map((b) => (
                      <BookingCard key={b.id} booking={b} variant="student" onOpenChat={(bookingToChat) => { setChatOrigin('list'); setSelectedBookingForChat(bookingToChat); }} onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)} />
                    ))
                  )}
                </div>
              )}

              {/* History Bookings Section */}
              {!bookingsError && !bookingsLoading && bookingTab === 'history' && (
                <div className="space-y-3">
                  {historyBookings.length === 0 ? (
                    <EmptyState title="Seu histórico está vazio" description="As aulas concluídas aparecerão aqui." />
                  ) : (
                    historyBookings.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        variant="student"
                        onViewDetails={(bookingToView) => setSelectedBookingForDetails(bookingToView)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <AppPageHeader
                eyebrow="Sua conta"
                title="Meu Perfil"
                action={!isEditingProfile ? (
                    <ButtonBase
                      type="button"
                      aria-label="Editar perfil"
                      title="Editar perfil"
                      onClick={() => setIsEditingProfile(true)}
                      className="mazzi-icon-button shrink-0 cursor-pointer"
                    >
                      <Pencil className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    </ButtonBase>
                  ) : undefined}
              />

              <div className="text-center pt-2">
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-[var(--mazzi-yellow)] text-2xl font-bold shadow-[var(--mazzi-shadow)] border border-[var(--mazzi-border)]">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Foto do perfil" className="h-full w-full object-cover" />
                  ) : user?.name ? (
                    user.name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()
                  ) : (
                    'AN'
                  )}
                </div>
                <h3 className="mt-4 truncate text-2xl font-bold text-[var(--mazzi-dark)]">{profileName || user?.name || 'Nome não informado'}</h3>
                <p className="mt-1 truncate text-sm text-[var(--mazzi-muted)]">{user?.email || 'E-mail não informado'}</p>
              </div>

              <div className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
                <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados do perfil</h4>
                {isEditingProfile ? (
                  <Modal
                    isOpen={isEditingProfile}
                    onClose={handleCancelStudentProfile}
                    title="Editar perfil"
                    footer={(
                      <>
                        <Button type="button" variant="dangerSoft" size="sm" disabled={profileSaving} onClick={handleCancelStudentProfile}>
                          Cancelar
                        </Button>
                        <PrimaryButton type="button" size="sm" className="font-bold shadow-xs" isLoading={profileSaving} disabled={profileSaving} onClick={() => { void handleSaveStudentProfile(); }}>
                          Salvar perfil
                        </PrimaryButton>
                      </>
                    )}
                  >
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-photo">
                        Foto de perfil
                      </label>
                      <div id="student-profile-photo">
                        <ProfilePhotoPicker
                          value={profileAvatar}
                          name={profileName || user?.name}
                          onChange={setProfileAvatar}
                          disabled={profileSaving}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-name">
                        Nome completo
                      </label>
                      <Input
                        id="student-profile-name"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        disabled={profileSaving}
                        className="w-full min-h-11 rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm text-[var(--mazzi-dark)] focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)] transition"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-phone">
                        Telefone
                      </label>
                      <Input
                        id="student-profile-phone"
                        value={profilePhone}
                        onChange={(event) => setProfilePhone(formatPhone(event.target.value))}
                        placeholder="(11) 99999-9999"
                        disabled={profileSaving}
                        className="w-full min-h-11 rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm text-[var(--mazzi-dark)] focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)] transition"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-birthdate">
                        Data de nascimento
                      </label>
                      <Input
                        id="student-profile-birthdate"
                        value={profileBirthDate}
                        onChange={(event) => setProfileBirthDate(formatDateMask(event.target.value))}
                        placeholder="DD/MM/AAAA"
                        disabled={profileSaving}
                        className="w-full min-h-11 rounded-2xl border border-[var(--mazzi-border)] px-3.5 py-2.5 text-sm text-[var(--mazzi-dark)] focus:border-[var(--mazzi-yellow)] focus:outline-none focus:ring-2 focus:ring-[var(--mazzi-focus-glow)] transition"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-cpf">
                        CPF
                      </label>
                      <Input
                        id="student-profile-cpf"
                        value={maskCpf(user?.cpf)}
                        readOnly
                        aria-readonly="true"
                        className="w-full min-h-11 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed font-mono"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        CPF não pode ser alterado pelo aplicativo.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700" htmlFor="student-profile-email">
                        E-mail
                      </label>
                      <Input
                        id="student-profile-email"
                        value={user?.email || ''}
                        readOnly
                        aria-readonly="true"
                        className="w-full min-h-11 rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                      />
                    </div>

                    {profileError && (
                      <p role="alert" className="text-xs font-semibold text-rose-700">
                        {profileError}
                      </p>
                    )}

                  </div>
                  </Modal>
                ) : (
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Telefone</dt>
                      <dd className="font-semibold text-slate-900">{profilePhone || 'Não informado'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">E-mail</dt>
                      <dd className="truncate font-semibold text-slate-900">{user?.email || 'Não informado'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">CPF</dt>
                      <dd className="font-mono font-semibold text-slate-900">{maskCpf(user?.cpf)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Data de nascimento</dt>
                      <dd className="font-semibold text-slate-900">{formatBirthDateForDisplay(user?.birthDate)}</dd>
                    </div>
                  </dl>
                )}
              </div>

              <div className="mazzi-hero text-left">
                <div className="p-5">
                  <span className="text-xl font-bold text-slate-900 block">
                    {historyBookings.filter((b) => b.status === 'COMPLETED').length}
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold">Aulas Concluídas</span>
                </div>
                <div className="p-5">
                  <span className="block text-xl font-bold text-white">
                    {upcomingBookings.length}
                  </span>
                  <span className="text-[11px] font-semibold text-white/60">Aulas Agendadas</span>
                </div>
              </div>

              <StudentProMigrationCard />

              <div className="flex justify-center border-t border-[var(--mazzi-border)] pt-4">
                <Button variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50 font-bold" onClick={() => { void logout(); }}>
                  Sair
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Bottom navigation: 3 main tabs for Student (Search, Bookings, Profile) */}
        <AppBottomNav
          ariaLabel="Navegação principal"
          activeId={activeTab}
          items={[
            { id: 'search', label: 'Buscar', icon: <Search className="w-5 h-5" /> },
            { id: 'bookings', label: 'Aulas', icon: <CalendarIcon className="w-5 h-5" /> },
            { id: 'profile', label: 'Perfil', icon: <User className="w-5 h-5" /> },
          ]}
          onChange={(tab) => setActiveTab(tab)}
        />

      <Modal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} title="Notificações" size="md">
        <NotificationsPanel />
      </Modal>

      {/* Booking Details Modal */}
      <BookingDetailsModal
        isOpen={!!selectedBookingForDetails}
        onClose={() => setSelectedBookingForDetails(null)}
        booking={selectedBookingForDetails}
        onBookingUpdated={(updated) => {
          setConfirmedBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          setBookingsRefreshKey((k) => k + 1);
          setSelectedBookingForDetails(updated);
        }}
        onReview={reviewsEligibilityStatus === 'SUCCESS' && selectedBookingForDetails?.status === 'COMPLETED' && !reviewedBookingIds.has(selectedBookingForDetails.id)
          ? (bookingToReview) => setSelectedBookingForReview(bookingToReview)
          : undefined}
        onContinuePayment={(bookingToResume) => {
          setSelectedBookingForDetails(null);
          setResumeBooking(bookingToResume);
        }}
        onOpenChat={() => {
          if (selectedBookingForDetails) {
            setChatOrigin('details');
            setSelectedBookingForChat(selectedBookingForDetails);
            setSelectedBookingForDetails(null);
          }
        }}
        onStudentCheckIn={async (bookingId) => {
          const { bookings, updatedBooking } = await studentCheckInAndRehydrateBooking(bookingId);
          setConfirmedBookings(bookings);
          setSelectedBookingForDetails(updatedBooking);
          return updatedBooking;
        }}
      />

      <Modal
        isOpen={!!selectedBookingForChat}
        onClose={() => {
          const target = selectedBookingForChat;
          setSelectedBookingForChat(null);
          if (chatOrigin === 'details' && target) {
            setSelectedBookingForDetails(target);
          }
        }}
        title="Chat da aula"
        size="lg"
      >
        {selectedBookingForChat && (
          <BookingChatPanel
            booking={selectedBookingForChat}
            onBack={() => {
              const target = selectedBookingForChat;
              setSelectedBookingForChat(null);
              if (chatOrigin === 'details' && target) {
                setSelectedBookingForDetails(target);
              }
            }}
          />
        )}
      </Modal>

      <ReviewModal
        isOpen={!!selectedBookingForReview}
        booking={selectedBookingForReview}
        onClose={() => setSelectedBookingForReview(null)}
        onSubmitted={() => {
          if (selectedBookingForReview) {
            setReviewedBookingIds((prev) => new Set([...prev, selectedBookingForReview.id]));
          }
        }}
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
              <ButtonBase
                key={`${ctx.instructor_id}-${ctx.offering_id}`}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-amber-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                onClick={() => {
                  const instructorId = ctx.instructor_id || ctx.instructorId;
                  const instructorContexts = filterBookingContextsByInstructor(bookingContextsForSelection, instructorId);
                  const offerings = uniqueBookingOfferingContexts(instructorContexts);
                  setInstructorPickerProvider(null);
                  setInstructorChoices([]);
                  if (offerings.length > 1) {
                    setBookingContextChoices(offerings);
                    setOfferingPickerProvider(instructorPickerProvider);
                    setOfferingPickerSlot(null);
                    return;
                  }
                  openCheckoutForContext(instructorPickerProvider, offerings[0] || instructorContexts[0] || ctx);
                }}
              >
                <span className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-amber-400">{(ctx.instructor_name || ctx.instructorName || 'Instrutor disponível').split(/\s+/).map((part: string) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-900">{ctx.instructor_name || ctx.instructorName || 'Instrutor disponível'}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-500">{ctx.vehicle_brand || 'Veículo'} {ctx.vehicle_model || ''} · {ctx.vehicle_transmission === 'AUTOMATIC' ? 'Automático' : 'Manual'} · Cat. {ctx.category || ctx.offering_category || 'B'}</span><span className="mt-1 block text-xs font-bold text-slate-700">{ctx.duration_minutes ? `${ctx.duration_minutes} min` : 'Duração a confirmar'} · {typeof ctx.price_in_cents === 'number' ? formatCentsToBRL(ctx.price_in_cents) : 'Preço a confirmar'}</span></span></span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
              </ButtonBase>
            ))}
          </div>
        </Modal>
      )}

      {offeringPickerProvider && (
        <Modal
          isOpen={true}
          onClose={() => { setOfferingPickerProvider(null); setBookingContextChoices([]); setOfferingPickerSlot(null); }}
          title="Escolha a oferta"
          size="sm"
        >
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-500">Escolha o veículo e a duração da sua aula.</p>
            {bookingContextChoices.map((ctx) => {
              const vehicleName = `${ctx.vehicle_brand || 'Veículo'} ${ctx.vehicle_model || ''}`.trim();
              const transmission = ctx.vehicle_transmission || ctx.transmission;
              return (
                <ButtonBase
                  key={ctx.offering_id || ctx.offeringId}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-amber-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                  onClick={() => {
                    openCheckoutForContext(offeringPickerProvider, ctx, offeringPickerSlot);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                      <Car className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-900">{vehicleName}</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                        {transmission === 'AUTOMATIC' ? 'Automático' : 'Manual'} · Cat. {ctx.category || ctx.offering_category || 'B'}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-slate-700">
                        {ctx.duration_minutes ? `${ctx.duration_minutes} min` : 'Duração a confirmar'} · {typeof ctx.price_in_cents === 'number' ? formatCentsToBRL(ctx.price_in_cents) : 'Preço a confirmar'}
                      </span>
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                </ButtonBase>
              );
            })}
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

      {/* Complete Checkout Journey Modal */}
      {((isCheckoutOpen && selectedSlot && checkoutProvider && checkoutVehicle && checkoutOffering) || !!resumeBooking) && (
        <CheckoutModal
          isOpen={isCheckoutOpen || !!resumeBooking}
          onClose={() => {
            setIsCheckoutOpen(false);
            setResumeBooking(null);
          }}
          provider={checkoutProvider}
          vehicle={checkoutVehicle}
          offering={checkoutOffering}
          scheduledDate={selectedSlot?.local_date || resumeBooking?.scheduledDate || ''}
          startTime={selectedSlot?.local_start_time?.substring(0, 5) || resumeBooking?.startTime || ''}
          endTime={selectedSlot?.local_end_time?.substring(0, 5) || resumeBooking?.endTime || ''}
          scheduledStartAt={selectedSlot?.slot_start_at || resumeBooking?.scheduledStartAt}
          existingBookings={confirmedBookings}
          resumeBooking={resumeBooking}
          onChooseAnotherSlot={() => {
            setIsCheckoutOpen(false);
            setResumeBooking(null);
            setSelectedSlot(null);
            setIsSlotSelectorOpen(true);
          }}
          onBookingConfirmed={(updatedBooking) => {
            setConfirmedBookings((prev) => {
              const exists = prev.some((b) => b.id === updatedBooking.id);
              if (exists) {
                return prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
              }
              return [updatedBooking, ...prev];
            });
            setBookingsRefreshKey((k) => k + 1);
            setResumeBooking(null);
          }}
          onGoToBookings={() => {
            setResumeBooking(null);
            setActiveTab('bookings');
          }}
        />
      )}
    </div>
  );
};


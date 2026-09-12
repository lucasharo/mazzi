import { queryClient, CACHE_POLICY } from './query-client';
import { queryKeys } from './query-keys';
import { dbService } from './db-service';
import type { Booking, InstantLessonOffer, InstantLessonRequest, InstantLessonTracking, Notification, ProviderEarningsPeriodPreset, ServiceOffering, Vehicle } from '../types';

type ProviderWorkspace = Awaited<ReturnType<typeof dbService.getProviderWorkspace>>;

export const serverState = {
  getPublicPlatformConfiguration: () => queryClient.fetchQuery({
    queryKey: queryKeys.platform.publicConfiguration(),
    queryFn: () => dbService.getPublicPlatformConfiguration(),
    ...CACHE_POLICY.long,
    meta: { cacheClass: 'long', persist: true },
  }),

  getStudentBookings: (studentId: string) => queryClient.fetchQuery({
    queryKey: queryKeys.student.bookings(studentId),
    queryFn: () => dbService.getBookings(),
    // Booking status, check-ins and cancellation are operational state. Never
    // serve a 45-second stale snapshot when a screen explicitly refreshes it.
    ...CACHE_POLICY.critical,
    meta: { cacheClass: 'server-authority' },
  }),

  getStudentActiveInstantLesson: (studentId: string) => queryClient.fetchQuery<{ request: InstantLessonRequest; offer?: InstantLessonOffer } | null>({
    queryKey: queryKeys.student.activeInstantLesson(studentId),
    queryFn: () => dbService.getMyActiveInstantRequest(),
    ...CACHE_POLICY.critical,
    meta: { cacheClass: 'server-authority' },
  }),

  getStudentInstantTracking: (studentId: string, bookingId: string) => queryClient.fetchQuery<InstantLessonTracking | null>({
    queryKey: queryKeys.student.instantTracking(studentId, bookingId),
    queryFn: () => dbService.getInstantTracking(bookingId),
    ...CACHE_POLICY.critical,
    meta: { cacheClass: 'server-authority' },
  }),

  getProviderWorkspace: (providerId: string, userId: string) => queryClient.fetchQuery<ProviderWorkspace>({
    queryKey: queryKeys.provider.workspace(providerId, userId),
    queryFn: () => dbService.getProviderWorkspace(providerId),
    ...CACHE_POLICY.short,
    meta: { cacheClass: 'short' },
  }),

  getProviderSummary: (providerId: string) => queryClient.fetchQuery({
    queryKey: ['provider', providerId, 'summary'] as const,
    queryFn: () => dbService.getProviderSummary(providerId),
    ...CACHE_POLICY.short,
    meta: { cacheClass: 'short' },
  }),

  getProviderBookings: (params: { providerId: string; userId: string; isInstructor: boolean }) => {
    const scope = params.isInstructor ? `instructor:${params.userId}` : 'provider-all';
    return queryClient.fetchQuery<Booking[]>({
      queryKey: queryKeys.provider.bookings(params.providerId, scope),
      queryFn: () => params.isInstructor ? dbService.getMyUnifiedInstructorBookings() : dbService.getMyProviderBookings(params.providerId),
      // The booking list is the source for the open detail modal and must
      // reflect lifecycle changes immediately after invalidation.
      ...CACHE_POLICY.critical,
      meta: { cacheClass: 'server-authority' },
    });
  },

  getProviderInstantOffers: (providerId: string, instructorId: string) => queryClient.fetchQuery<{ offers: InstantLessonOffer[]; serverNow: string }>({
    queryKey: queryKeys.provider.instantOffers(providerId, instructorId),
    queryFn: () => dbService.getMyInstantOffers(),
    ...CACHE_POLICY.critical,
    meta: { cacheClass: 'server-authority' },
  }),

  getProviderVehicles: (providerId: string) => queryClient.fetchQuery<Vehicle[]>({
    queryKey: queryKeys.provider.vehicles(providerId),
    queryFn: () => dbService.getProviderVehicles(providerId),
    ...CACHE_POLICY.long,
    meta: { cacheClass: 'long', persist: true },
  }),

  getProviderOfferings: (providerId: string) => queryClient.fetchQuery<ServiceOffering[]>({
    queryKey: queryKeys.provider.offerings(providerId),
    queryFn: () => dbService.getProviderOfferings(providerId),
    ...CACHE_POLICY.long,
    meta: { cacheClass: 'long', persist: true },
  }),

  getProviderEarnings: (params: { providerId: string; userId: string; period: ProviderEarningsPeriodPreset }) => queryClient.fetchQuery({
    queryKey: queryKeys.provider.earnings(params.providerId, params.userId, params.period),
    queryFn: () => dbService.getProviderEarningsSummary(params.period),
    staleTime: 60 * 1_000,
    gcTime: 15 * 60 * 1_000,
    meta: { cacheClass: 'short' },
  }),

  getNotifications: (params: { appContext: NonNullable<Notification['appContext']>; userId: string; providerId?: string }) => {
    const queryKey = params.appContext === 'STUDENT'
      ? queryKeys.student.notifications(params.userId)
      : queryKeys.provider.notifications(params.providerId || 'unknown', params.userId);
    return queryClient.fetchQuery<Notification[]>({
      queryKey,
      queryFn: () => dbService.getMyNotifications(params.appContext),
      ...CACHE_POLICY.short,
      staleTime: 20 * 1_000,
      meta: { cacheClass: 'short' },
    });
  },

  getUnreadNotificationCount: (params: { appContext: NonNullable<Notification['appContext']>; userId: string; providerId?: string }) => {
    const queryKey = params.appContext === 'STUDENT'
      ? queryKeys.student.unreadNotifications(params.userId)
      : queryKeys.provider.unreadNotifications(params.providerId || 'unknown', params.userId);
    return queryClient.fetchQuery<number>({
      queryKey,
      queryFn: () => dbService.getMyUnreadNotificationCount(params.appContext),
      ...CACHE_POLICY.short,
      staleTime: 20 * 1_000,
      meta: { cacheClass: 'short' },
    });
  },
};

export async function invalidateStudentBookingQueries(studentId: string, bookingId?: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.student.bookings(studentId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.student.dashboard(studentId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.student.nextLesson(studentId) }),
    ...(bookingId ? [queryClient.invalidateQueries({ queryKey: queryKeys.booking.detail(bookingId) }), queryClient.invalidateQueries({ queryKey: queryKeys.payment.byBooking(bookingId) })] : []),
  ]);
}

export async function invalidateProviderBookingQueries(providerId: string, userId: string, bookingId?: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'bookings'] }),
    queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'workspace'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.dashboard(providerId, `instructor:${userId}`) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.nextLesson(providerId, `instructor:${userId}`) }),
    ...(bookingId ? [queryClient.invalidateQueries({ queryKey: queryKeys.booking.detail(bookingId) }), queryClient.invalidateQueries({ queryKey: queryKeys.payment.byBooking(bookingId) })] : []),
  ]);
}

export async function invalidateNotificationQueries(params: { appContext: 'STUDENT' | 'PRO'; userId: string; providerId?: string }): Promise<void> {
  const keys = params.appContext === 'STUDENT'
    ? [queryKeys.student.notifications(params.userId), queryKeys.student.unreadNotifications(params.userId)]
    : params.providerId
      ? [queryKeys.provider.notifications(params.providerId, params.userId), queryKeys.provider.unreadNotifications(params.providerId, params.userId)]
      : [];
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export async function invalidateStudentInstantQueries(studentId: string, bookingId?: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.student.activeInstantLesson(studentId) }),
    ...(bookingId ? [queryClient.invalidateQueries({ queryKey: queryKeys.student.instantTracking(studentId, bookingId) })] : []),
  ]);
}

export async function invalidateProviderInstantQueries(providerId: string, instructorId: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.instantOffers(providerId, instructorId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.instantSettings(providerId, instructorId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.instructorStatuses(providerId) }),
  ]);
}

export async function invalidateProviderCatalogQueries(providerId: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.vehicles(providerId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.offerings(providerId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.provider.workspace(providerId, 'unknown') }),
    queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'workspace'] }),
  ]);
}

export async function invalidateProviderEarningsQueries(providerId: string, userId: string): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['provider', providerId, 'earnings', userId] });
}

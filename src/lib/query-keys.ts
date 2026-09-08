/**
 * Canonical server-state keys used by the Student and PRO bundles.
 *
 * Keep identity in every key. In particular, provider-scoped data must carry
 * the instructor scope when the result is instructor-specific; provider_id
 * alone is not a safe cache boundary for a multi-instructor school.
 */
export const queryKeys = {
  platform: {
    publicConfiguration: () => ['platform', 'public-configuration'] as const,
  },
  student: {
    bookings: (studentId: string) => ['student', studentId, 'bookings'] as const,
    dashboard: (studentId: string) => ['student', studentId, 'dashboard'] as const,
    nextLesson: (studentId: string) => ['student', studentId, 'next-lesson'] as const,
    notifications: (studentId: string) => ['student', studentId, 'notifications'] as const,
    unreadNotifications: (studentId: string) => ['student', studentId, 'notifications', 'unread'] as const,
    activeInstantLesson: (studentId: string) => ['student', studentId, 'instant-lesson', 'active'] as const,
    instantTracking: (studentId: string, bookingId: string) => ['student', studentId, 'instant-lesson', 'tracking', bookingId] as const,
    search: (studentId: string, filterKey: string) => ['student', studentId, 'search', filterKey] as const,
  },
  provider: {
    workspace: (providerId: string, userId: string) => ['provider', providerId, userId, 'workspace'] as const,
    bookings: (providerId: string, scope: string) => ['provider', providerId, 'bookings', scope] as const,
    dashboard: (providerId: string, scope: string) => ['provider', providerId, 'dashboard', scope] as const,
    nextLesson: (providerId: string, scope: string) => ['provider', providerId, 'next-lesson', scope] as const,
    vehicles: (providerId: string) => ['provider', providerId, 'vehicles'] as const,
    offerings: (providerId: string) => ['provider', providerId, 'offerings'] as const,
    notifications: (providerId: string, userId: string) => ['provider', providerId, userId, 'notifications'] as const,
    unreadNotifications: (providerId: string, userId: string) => ['provider', providerId, userId, 'notifications', 'unread'] as const,
    instantOffers: (providerId: string, instructorId: string) => ['provider', providerId, instructorId, 'instant-lesson', 'offers'] as const,
    instantSettings: (providerId: string, instructorId: string) => ['provider', providerId, instructorId, 'instant-lesson', 'settings'] as const,
    instructorStatuses: (providerId: string) => ['provider', providerId, 'instant-lesson', 'instructor-statuses'] as const,
    earnings: (providerId: string, scope: string, period: number) => ['provider', providerId, 'earnings', scope, period] as const,
  },
  booking: {
    detail: (bookingId: string) => ['booking', bookingId, 'detail'] as const,
  },
  payment: {
    byBooking: (bookingId: string) => ['payment', 'booking', bookingId] as const,
  },
} as const;

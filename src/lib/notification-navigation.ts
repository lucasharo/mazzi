import type { Notification, NotificationAppContext, NotificationType } from '../types';

export type NotificationNavigationEntity = 'booking' | 'payout' | 'earnings' | 'compliance';
export type NotificationNavigationAction = 'details' | 'chat' | 'review' | 'reviews' | 'compliance';

export interface NotificationNavigationTarget {
  version: 1;
  appContext: NotificationAppContext;
  entityType: NotificationNavigationEntity;
  entityId: string | null;
  action: NotificationNavigationAction;
}

export type NotificationNavigationResult =
  | { ok: true; target: NotificationNavigationTarget }
  | { ok: false; reason: 'INVALID_TARGET' | 'UNSUPPORTED_DESTINATION' };

const UUID_V4_OR_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-(?:4[0-9a-f]{3}|7[0-9a-f]{3})-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set(['version', 'appContext', 'entityType', 'entityId', 'action']);
const ALLOWED_TYPES = new Set<NotificationNavigationEntity>(['booking', 'payout', 'earnings', 'compliance']);
const ALLOWED_ACTIONS = new Set<NotificationNavigationAction>(['details', 'chat', 'review', 'reviews', 'compliance']);
const ALLOWED_CONTEXTS = new Set<NotificationAppContext>(['STUDENT', 'PRO', 'ADMIN']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCombination(target: NotificationNavigationTarget): boolean {
  if (!ALLOWED_CONTEXTS.has(target.appContext) || !ALLOWED_TYPES.has(target.entityType) || !ALLOWED_ACTIONS.has(target.action)) return false;
  if (target.appContext === 'STUDENT' && target.entityType !== 'booking') return false;
  if (target.appContext === 'PRO' && target.entityType === 'booking' && target.action === 'review') return false;
  if (target.appContext === 'ADMIN' && target.entityType !== 'booking') return false;
  if (target.entityType === 'booking') return target.action === 'details' || target.action === 'chat' || target.action === 'review' ? Boolean(target.entityId) : false;
  if (target.entityType === 'payout') return target.appContext === 'PRO' && target.action === 'details' && Boolean(target.entityId);
  if (target.entityType === 'compliance') return target.appContext === 'PRO' && target.action === 'compliance' && Boolean(target.entityId);
  return target.entityType === 'earnings' && target.appContext === 'PRO' && target.action === 'reviews' && target.entityId === null;
}

export function validateNotificationNavigationTarget(value: unknown): NotificationNavigationResult {
  if (!isRecord(value) || Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) return { ok: false, reason: 'INVALID_TARGET' };
  const target = value as Partial<NotificationNavigationTarget>;
  if (target.version !== 1 || typeof target.appContext !== 'string' || typeof target.entityType !== 'string' || typeof target.action !== 'string') return { ok: false, reason: 'INVALID_TARGET' };
  if (target.entityId !== null && (typeof target.entityId !== 'string' || target.entityId.length > 64 || !UUID_V4_OR_V7.test(target.entityId))) return { ok: false, reason: 'INVALID_TARGET' };
  const normalized = { version: 1 as const, appContext: target.appContext as NotificationAppContext, entityType: target.entityType as NotificationNavigationEntity, entityId: target.entityId ?? null, action: target.action as NotificationNavigationAction };
  return isValidCombination(normalized) ? { ok: true, target: normalized } : { ok: false, reason: 'UNSUPPORTED_DESTINATION' };
}

export function targetFromNotification(notification: Pick<Notification, 'type' | 'appContext' | 'entityType' | 'entityId'>): NotificationNavigationResult {
  const appContext = notification.appContext;
  if (!appContext) return { ok: false, reason: 'INVALID_TARGET' };
  let entityType: NotificationNavigationEntity;
  let action: NotificationNavigationAction;
  let entityId: string | null = notification.entityId || null;
  switch (notification.type as NotificationType | 'PAYOUT_PAID' | 'PAYOUT_BLOCKED' | 'PAYOUT_FAILED' | 'COMPLIANCE_PENDING') {
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_CANCELLED':
    case 'STUDENT_CHECKIN':
    case 'PROVIDER_CHECKIN':
    case 'LESSON_STARTED':
    case 'LESSON_COMPLETED':
    case 'REVIEW_AVAILABLE':
    case 'CONTESTATION_UPDATED':
      entityType = 'booking'; action = (notification.type === 'LESSON_COMPLETED' || notification.type === 'REVIEW_AVAILABLE') && appContext === 'STUDENT' ? 'review' : 'details'; break;
    case 'NEW_MESSAGE': entityType = 'booking'; action = 'chat'; break;
    case 'PAYOUT_PAID':
    case 'PAYOUT_BLOCKED':
    case 'PAYOUT_FAILED': entityType = 'payout'; action = 'details'; break;
    case 'COMPLIANCE_PENDING': entityType = 'compliance'; action = 'compliance'; break;
    case 'REVIEW_RECEIVED': entityType = 'earnings'; action = 'reviews'; entityId = null; break;
    default: return { ok: false, reason: 'UNSUPPORTED_DESTINATION' };
  }
  return validateNotificationNavigationTarget({ version: 1, appContext, entityType, entityId, action });
}

export function serializeNotificationNavigationTarget(target: NotificationNavigationTarget): string {
  const validated = validateNotificationNavigationTarget(target);
  if (!validated.ok) return '';
  const params = new URLSearchParams({ v: '1', c: target.appContext, e: target.entityType, a: target.action });
  if (target.entityId) params.set('id', target.entityId);
  return params.toString();
}

export function parseNotificationNavigationTarget(value: string | URLSearchParams): NotificationNavigationResult {
  const params = typeof value === 'string' ? new URLSearchParams(value.startsWith('?') ? value.slice(1) : value) : value;
  const allowed = new Set(['v', 'c', 'e', 'a', 'id']);
  for (const key of params.keys()) if (!allowed.has(key)) return { ok: false, reason: 'INVALID_TARGET' };
  const version = params.get('v');
  const appContext = params.get('c');
  const entityType = params.get('e');
  const action = params.get('a');
  if (!version || !appContext || !entityType || !action) return { ok: false, reason: 'INVALID_TARGET' };
  return validateNotificationNavigationTarget({ version: Number(version), appContext, entityType, action, entityId: params.get('id') });
}

export function appRouteForNotificationTarget(target: NotificationNavigationTarget): 'bookings' | 'earnings' | 'management' {
  if (target.entityType === 'booking') return 'bookings';
  if (target.entityType === 'compliance') return 'management';
  return 'earnings';
}

export function fallbackRouteForNotificationTarget(target: NotificationNavigationTarget): 'bookings' | 'earnings' | 'management' {
  return appRouteForNotificationTarget(target);
}

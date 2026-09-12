import { BackgroundGeolocation, type CallbackError, type Location } from '@capgo/background-geolocation';
import { CapacitorHttp } from '@capacitor/core';
import { INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS } from '../domain/instant-lesson';
import { isNativeApp } from './native-platform';
import { supabase, supabasePublicConfig } from './supabase';

const LOCATION_INTERVAL_MS = INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS * 1_000;
const NOTIFICATION_TITLE = 'MAZZI PRO — Aula Agora';
const NOTIFICATION_MESSAGE = 'Sua localização está sendo atualizada enquanto você está disponível.';

type TrackingFailureKind = 'SESSION' | 'AUTHORIZATION' | 'NETWORK';

class TrackingFailure extends Error {
  constructor(public readonly kind: TrackingFailureKind, message: string) {
    super(message);
    this.name = 'TrackingFailure';
  }
}

export interface ProviderBackgroundLocationOptions {
  providerId: string;
  instructorId: string;
  onlineExpiresAt: string;
  onLocationUploaded?: () => void;
  onError?: (error: Error) => void;
}

let lifecycleQueue: Promise<unknown> = Promise.resolve();
let trackingGeneration = 0;
let expirationTimer: ReturnType<typeof setTimeout> | null = null;
let uploadInFlightGeneration: number | null = null;

function enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
  const queued = lifecycleQueue.then(operation, operation);
  lifecycleQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

function clearExpirationTimer(): void {
  if (expirationTimer) clearTimeout(expirationTimer);
  expirationTimer = null;
}

function reportNativeStopFailure(error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Background location service stop failed:', error);
  }
}

export function isUsableProviderLocation(location: Pick<Location, 'latitude' | 'longitude'>): boolean {
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180;
}

async function uploadInstantLocationWithNativeHttp(
  providerId: string,
  instructorId: string,
  location: Pick<Location, 'latitude' | 'longitude'>,
): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== instructorId) {
    throw new TrackingFailure('SESSION', 'A sessão do instrutor não está mais ativa.');
  }

  const response = await CapacitorHttp.post({
    url: `${supabasePublicConfig.url}/rest/v1/rpc/upsert_my_instant_location`,
    headers: {
      apikey: supabasePublicConfig.publishableKey,
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    data: {
      p_provider_id: providerId,
      p_instructor_id: instructorId,
      p_latitude: location.latitude,
      p_longitude: location.longitude,
    },
    connectTimeout: 12_000,
    readTimeout: 12_000,
  });

  if (response.status === 401 || response.status === 403) {
    throw new TrackingFailure('AUTHORIZATION', 'O envio de localização não está mais autorizado.');
  }
  if (response.status < 200 || response.status >= 300) {
    throw new TrackingFailure('NETWORK', `Falha temporária no envio de localização (${response.status}).`);
  }
}

function shouldStopAfter(error: unknown): boolean {
  return error instanceof TrackingFailure
    && (error.kind === 'SESSION' || error.kind === 'AUTHORIZATION');
}

export async function stopProviderBackgroundLocation(): Promise<void> {
  trackingGeneration += 1;
  clearExpirationTimer();

  if (!isNativeApp()) return;

  await enqueueLifecycle(async () => {
    try {
      await BackgroundGeolocation.stop();
    } catch (error) {
      reportNativeStopFailure(error);
    }
  });
}

export async function startProviderBackgroundLocation(
  options: ProviderBackgroundLocationOptions,
): Promise<boolean> {
  if (!isNativeApp()) return false;

  const expiresAtMs = new Date(options.onlineExpiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await stopProviderBackgroundLocation();
    return false;
  }

  const generation = ++trackingGeneration;
  clearExpirationTimer();

  return enqueueLifecycle(async () => {
    if (generation !== trackingGeneration) return false;

    try {
      // Also clears a service restored by Android from an earlier app process.
      await BackgroundGeolocation.stop();
    } catch (error) {
      reportNativeStopFailure(error);
    }

    if (generation !== trackingGeneration) return false;

    try {
      await BackgroundGeolocation.start({
        backgroundTitle: NOTIFICATION_TITLE,
        backgroundMessage: NOTIFICATION_MESSAGE,
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
        minIntervalMs: LOCATION_INTERVAL_MS,
        networkFallback: true,
      }, (location?: Location, callbackError?: CallbackError) => {
        if (generation !== trackingGeneration) return;

        if (callbackError) {
          options.onError?.(callbackError);
          void stopProviderBackgroundLocation();
          return;
        }
        if (!location || !isUsableProviderLocation(location)) return;
        if (Date.now() >= expiresAtMs) {
          void stopProviderBackgroundLocation();
          return;
        }
        if (uploadInFlightGeneration === generation) return;

        uploadInFlightGeneration = generation;
        void uploadInstantLocationWithNativeHttp(options.providerId, options.instructorId, location)
          .then(() => {
            if (generation === trackingGeneration) options.onLocationUploaded?.();
          })
          .catch((error: unknown) => {
            if (generation !== trackingGeneration) return;
            const normalizedError = error instanceof Error ? error : new Error('Falha ao atualizar a localização.');
            options.onError?.(normalizedError);
            if (shouldStopAfter(error)) void stopProviderBackgroundLocation();
          })
          .finally(() => {
            if (uploadInFlightGeneration === generation) uploadInFlightGeneration = null;
          });
      });
    } catch (error) {
      if (generation === trackingGeneration) {
        const normalizedError = error instanceof Error ? error : new Error('Falha ao iniciar a localização em segundo plano.');
        options.onError?.(normalizedError);
      }
      return false;
    }

    if (generation !== trackingGeneration) {
      try {
        await BackgroundGeolocation.stop();
      } catch (error) {
        reportNativeStopFailure(error);
      }
      return false;
    }

    expirationTimer = setTimeout(() => {
      void stopProviderBackgroundLocation();
    }, Math.max(0, expiresAtMs - Date.now()));
    return true;
  });
}

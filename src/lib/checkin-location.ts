import { getCurrentPositionCompat, isNativeApp } from './native-platform';

export interface CheckInLocation {
  latitude: number;
  longitude: number;
}

export function requestCheckInLocation(): Promise<CheckInLocation> {
  if (typeof navigator === 'undefined' || (!navigator.geolocation && !isNativeApp())) {
    return Promise.reject(new Error('CHECKIN_LOCATION_UNAVAILABLE'));
  }

  if (!isNativeApp()) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const latitude = Number(coords.latitude);
          const longitude = Number(coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
            || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            reject(new Error('CHECKIN_LOCATION_INVALID'));
            return;
          }
          resolve({ latitude, longitude });
        },
        () => reject(new Error('CHECKIN_LOCATION_DENIED')),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    });
  }

  return new Promise((resolve, reject) => {
    getCurrentPositionCompat({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }).then(
      ({ coords }) => {
        const latitude = Number(coords.latitude);
        const longitude = Number(coords.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
          || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
          reject(new Error('CHECKIN_LOCATION_INVALID'));
          return;
        }
        resolve({ latitude, longitude });
      },
      () => reject(new Error('CHECKIN_LOCATION_DENIED')),
    );
  });
}

import { describe, it, expect } from 'vitest';
import {
  buildNavigationUrl,
  isValidNavigationTarget,
  getAvailableNavigationApps,
} from '../src/lib/external-navigation-service';

describe('External Navigation Service', () => {
  const validLocation = {
    latitude: -23.55052,
    longitude: -46.633308,
    label: 'Avenida Paulista, 1000 - São Paulo',
  };

  describe('isValidNavigationTarget', () => {
    it('returns true for valid latitude/longitude bounds', () => {
      expect(isValidNavigationTarget({ latitude: -23.55052, longitude: -46.633308 })).toBe(true);
      expect(isValidNavigationTarget({ latitude: 0, longitude: 0 })).toBe(true);
      expect(isValidNavigationTarget({ latitude: 90, longitude: 180 })).toBe(true);
      expect(isValidNavigationTarget({ latitude: -90, longitude: -180 })).toBe(true);
    });

    it('returns false for invalid coordinates', () => {
      expect(isValidNavigationTarget({ latitude: 91, longitude: 0 })).toBe(false);
      expect(isValidNavigationTarget({ latitude: -91, longitude: 0 })).toBe(false);
      expect(isValidNavigationTarget({ latitude: 0, longitude: 181 })).toBe(false);
      expect(isValidNavigationTarget({ latitude: 0, longitude: -181 })).toBe(false);
      expect(isValidNavigationTarget({ latitude: NaN, longitude: -46 })).toBe(false);
      expect(isValidNavigationTarget(null)).toBe(false);
    });
  });

  describe('buildNavigationUrl', () => {
    it('generates valid URLs for Google Maps, Waze, Apple Maps, and Web Fallback', () => {
      expect(buildNavigationUrl(validLocation, 'google')).toContain('google.com/maps/dir/?api=1&destination=-23.55052,-46.633308');
      expect(buildNavigationUrl(validLocation, 'waze')).toContain('waze.com/ul?ll=-23.55052,-46.633308&navigate=yes');
      expect(buildNavigationUrl(validLocation, 'apple')).toContain('maps.apple.com/?daddr=-23.55052,-46.633308');
      expect(buildNavigationUrl(validLocation, 'web')).toContain('maps.google.com/?q=-23.55052,-46.633308');
    });
  });

  describe('getAvailableNavigationApps', () => {
    it('returns available navigation app options', () => {
      const options = getAvailableNavigationApps();
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options.some((opt) => opt.id === 'google')).toBe(true);
      expect(options.some((opt) => opt.id === 'waze')).toBe(true);
      expect(options.some((opt) => opt.id === 'web')).toBe(true);
    });
  });
});

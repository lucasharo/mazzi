// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMobileAppRoute } from '../src/lib/mobile-app-router';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('useMobileAppRoute', () => {
  it('keeps mobile app tabs in the browser history', () => {
    const { result } = renderHook(() => useMobileAppRoute('student', 'search', ['search', 'bookings', 'profile'] as const));

    expect(result.current[0]).toBe('search');
    act(() => result.current[1]('bookings'));
    expect(result.current[0]).toBe('bookings');
    expect(window.location.hash).toBe('#/student/bookings');

    act(() => {
      window.history.replaceState({}, '', '/#/student/search');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current[0]).toBe('search');
  });

  it('restores a valid route already present in the URL', () => {
    window.history.replaceState({}, '', '/#/provider/management');
    const { result } = renderHook(() => useMobileAppRoute('provider', 'dashboard', ['dashboard', 'schedule', 'bookings', 'management', 'profile'] as const));

    expect(result.current[0]).toBe('management');
  });
});

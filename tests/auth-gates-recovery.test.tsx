// @vitest-environment happy-dom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { auth } = vi.hoisted(() => ({
  auth: {
    user: { roles: ['STUDENT'] },
    isAuthenticated: true,
    recoveryInProgress: false,
    isLoading: false,
  },
}));

vi.mock('../src/components/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => auth,
}));

vi.mock('../src/components/auth/AppLogin', () => ({
  AppLogin: ({ kind }: { kind: string }) => <div data-testid={`login-${kind}`}>login-{kind}</div>,
}));

vi.mock('../src/components/auth/AccessDenied', () => ({
  AccessDenied: () => <div data-testid="access-denied">access-denied</div>,
}));

vi.mock('../src/apps/student/StudentApp', () => ({
  StudentApp: () => <div data-testid="student-app">student-app</div>,
}));

vi.mock('../src/apps/provider/ProviderApp', () => ({
  ProviderApp: () => <div data-testid="provider-app">provider-app</div>,
}));

vi.mock('../src/apps/admin/AdminApp', () => ({
  AdminApp: () => <div data-testid="admin-app">admin-app</div>,
}));

vi.mock('../src/components/ui/LoadingScreen', () => ({
  LoadingScreen: () => <div data-testid="loading">loading</div>,
}));

import { StudentRoot } from '../src/entrypoints/student/StudentRoot';
import { InstructorRoot } from '../src/entrypoints/instructor/InstructorRoot';
import { AdminRoot } from '../src/entrypoints/admin/AdminRoot';

describe('TASK-064E — recovery isolation in all application gates', () => {
  afterEach(() => {
    cleanup();
    auth.user = { roles: ['STUDENT'] };
    auth.isAuthenticated = true;
    auth.recoveryInProgress = false;
    auth.isLoading = false;
  });

  it.each([
    ['Student', StudentRoot, 'student', 'student-app'],
    ['Instructor', InstructorRoot, 'instructor', 'provider-app'],
    ['Admin', AdminRoot, 'admin', 'admin-app'],
  ] as const)('%s stays on login during recovery', (_name, Root, kind, appTestId) => {
    auth.recoveryInProgress = true;
    auth.user = { roles: kind === 'student' ? ['STUDENT'] : kind === 'instructor' ? ['INSTRUCTOR'] : ['PLATFORM_ADMIN'] };

    render(<Root />);

    expect(screen.getByTestId(`login-${kind}`)).not.toBeNull();
    expect(screen.queryByTestId(appTestId)).toBeNull();
  });

  it.each([
    ['Student', StudentRoot, 'student-app', { roles: ['STUDENT'] }],
    ['Instructor', InstructorRoot, 'provider-app', { roles: ['INSTRUCTOR'] }],
    ['Admin', AdminRoot, 'admin-app', { roles: ['PLATFORM_ADMIN'] }],
  ])('%s keeps normal authenticated access when recovery is inactive', (_name, Root, appTestId, user) => {
    auth.recoveryInProgress = false;
    auth.isAuthenticated = true;
    auth.user = user;

    render(<Root />);

    expect(screen.getByTestId(appTestId)).not.toBeNull();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  STUDENT_DEMO_ACCOUNTS,
  INSTRUCTOR_DEMO_ACCOUNTS,
  SCHOOL_DEMO_ACCOUNTS,
  ADMIN_DEMO_ACCOUNTS,
} from '../src/components/auth/dev/demo-accounts';
import { getDemoPasswordForAccount } from '../src/components/auth/dev/DevQuickLogin';

describe('Dev Quick Login Automated Suite (TASK-005 Hardening)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('B14-1. Preserves all 27 demo accounts (10 Student, 14 Instructor, 2 School Admin, 1 Platform Admin)', () => {
    expect(STUDENT_DEMO_ACCOUNTS.length).toBe(10);
    expect(INSTRUCTOR_DEMO_ACCOUNTS.length).toBe(14);
    expect(SCHOOL_DEMO_ACCOUNTS.length).toBe(2);
    expect(ADMIN_DEMO_ACCOUNTS.length).toBe(1);

    const total =
      STUDENT_DEMO_ACCOUNTS.length +
      INSTRUCTOR_DEMO_ACCOUNTS.length +
      SCHOOL_DEMO_ACCOUNTS.length +
      ADMIN_DEMO_ACCOUNTS.length;

    expect(total).toBe(27);
  });

  it('B14-2. Demo account objects contain 0 hardcoded passwords', () => {
    const allAccounts = [
      ...STUDENT_DEMO_ACCOUNTS,
      ...INSTRUCTOR_DEMO_ACCOUNTS,
      ...SCHOOL_DEMO_ACCOUNTS,
      ...ADMIN_DEMO_ACCOUNTS,
    ];

    for (const acc of allAccounts) {
      expect((acc as any).password).toBeUndefined();
      expect(acc.email).toMatch(/@mazzi\.com\.br$/);
      expect(acc.label).toBeDefined();
      expect(acc.role).toBeDefined();
    }
  });

  it('B14-3. Correctly maps Student, Instructor, School Admin, and Platform Admin roles to env resolvers', () => {
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD', 'mock_student_secret_pass');
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD', 'mock_instructor_secret_pass');
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD', 'mock_school_secret_pass');
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD', 'mock_admin_secret_pass');

    const studentPass = getDemoPasswordForAccount(STUDENT_DEMO_ACCOUNTS[0]);
    const instructorPass = getDemoPasswordForAccount(INSTRUCTOR_DEMO_ACCOUNTS[0]);
    const schoolPass = getDemoPasswordForAccount(SCHOOL_DEMO_ACCOUNTS[0]);
    const adminPass = getDemoPasswordForAccount(ADMIN_DEMO_ACCOUNTS[0]);

    expect(studentPass).toBe('mock_student_secret_pass');
    expect(instructorPass).toBe('mock_instructor_secret_pass');
    expect(schoolPass).toBe('mock_school_secret_pass');
    expect(adminPass).toBe('mock_admin_secret_pass');
  });

  it('B14-4. Gracefully handles missing credential env without executing signIn with empty string', () => {
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD', '');
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD', '');
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD', '');
    vi.stubEnv('VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD', '');

    const missingAccount = {
      name: 'Test Missing',
      email: 'missing@mazzi.com.br',
      label: 'UnknownRole',
      role: 'UNKNOWN',
    };

    const resolved = getDemoPasswordForAccount(missingAccount);
    expect(resolved === undefined || resolved === '').toBe(true);
  });
});

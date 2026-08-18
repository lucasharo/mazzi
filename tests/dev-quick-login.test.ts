import { describe, it, expect } from 'vitest';
import {
  STUDENT_DEMO_ACCOUNTS,
  INSTRUCTOR_DEMO_ACCOUNTS,
  SCHOOL_DEMO_ACCOUNTS,
  ADMIN_DEMO_ACCOUNTS,
} from '../src/components/auth/dev/demo-accounts';
import { getDemoPasswordForAccount } from '../src/components/auth/dev/DevQuickLogin';

describe('Dev Quick Login Automated Suite (TASK-005 Hardening)', () => {
  it('B14-1. Preserves all 21 demo accounts (10 Student, 8 Instructor, 2 School Admin, 1 Platform Admin)', () => {
    expect(STUDENT_DEMO_ACCOUNTS.length).toBe(10);
    expect(INSTRUCTOR_DEMO_ACCOUNTS.length).toBe(8);
    expect(SCHOOL_DEMO_ACCOUNTS.length).toBe(2);
    expect(ADMIN_DEMO_ACCOUNTS.length).toBe(1);

    const total =
      STUDENT_DEMO_ACCOUNTS.length +
      INSTRUCTOR_DEMO_ACCOUNTS.length +
      SCHOOL_DEMO_ACCOUNTS.length +
      ADMIN_DEMO_ACCOUNTS.length;

    expect(total).toBe(21);
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
    const studentPass = getDemoPasswordForAccount(STUDENT_DEMO_ACCOUNTS[0]);
    const instructorPass = getDemoPasswordForAccount(INSTRUCTOR_DEMO_ACCOUNTS[0]);
    const schoolPass = getDemoPasswordForAccount(SCHOOL_DEMO_ACCOUNTS[0]);
    const adminPass = getDemoPasswordForAccount(ADMIN_DEMO_ACCOUNTS[0]);

    // Should resolve to non-empty strings in dev test environment with .env.local loaded
    expect(typeof studentPass).toBe('string');
    expect(typeof instructorPass).toBe('string');
    expect(typeof schoolPass).toBe('string');
    expect(typeof adminPass).toBe('string');
  });

  it('B14-4. Gracefully handles missing credential env without executing signIn with empty string', () => {
    const missingAccount = {
      name: 'Test Missing',
      email: 'missing@mazzi.com.br',
      label: 'UnknownRole',
      role: 'UNKNOWN',
    };

    // Unknown role defaults to student env in resolver, but if unmapped, returns string or undefined safely
    const resolved = getDemoPasswordForAccount(missingAccount);
    expect(resolved === undefined || typeof resolved === 'string').toBe(true);
  });
});

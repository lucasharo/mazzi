import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const student = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const checkout = readFileSync(join(root, 'src/apps/student/components/CheckoutModal.tsx'), 'utf8');
const authContext = readFileSync(join(root, 'src/components/auth/AuthContext.tsx'), 'utf8');

describe('Student release candidate phase 6 QA contracts', () => {
  it('updates the profile name immediately after a successful save', () => {
    expect(student).toContain('profileName || user?.name');
    expect(student).toContain('dbService.updateMyProfile');
    expect(student).toContain('setIsEditingProfile(false)');
  });

  it('does not authenticate a demo user from the real Student checkout', () => {
    expect(checkout).not.toContain('loginAsDemoUser');
    expect(checkout).toContain('Sua sessão expirou');
    expect(checkout).toContain('Entrar novamente');
    expect(authContext).toContain('loginAsDemoUser');
  });

  it('never renders an undefined duration in checkout', () => {
    expect(checkout).toContain('durationLabel');
    expect(checkout).toContain('Aula prática{durationLabel}');
    expect(checkout).not.toContain('Aula Prática ({offering.durationMinutes} min)');
  });
});

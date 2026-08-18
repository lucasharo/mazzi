import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const studentApp = readFileSync(join(root, 'src/apps/student/StudentApp.tsx'), 'utf8');
const searchHeader = readFileSync(join(root, 'src/components/search/SearchHeader.tsx'), 'utf8');
const providerCard = readFileSync(join(root, 'src/components/search/ProviderResultCard.tsx'), 'utf8');

describe('Student new template phase 1', () => {
  it('uses a full-width mobile-first shell with notification bell and focused 3-tab navigation', () => {
    expect(studentApp).toContain('mazzi-app');
    expect(studentApp).toContain('aria-label="Abrir notificações"');
    expect(studentApp).toContain("id: 'search'");
    expect(studentApp).toContain("id: 'bookings'");
    expect(studentApp).toContain("id: 'profile'");
    expect(studentApp).not.toContain("id: 'messages'");
    expect(studentApp).not.toContain("id: 'notifications'");
    expect(studentApp).not.toContain('max-w-md z-40');
  });

  it('keeps the Student MVP focused on category B', () => {
    expect(studentApp).toContain("category: 'B'");
    expect(searchHeader).not.toContain('Cat. B');
    expect(searchHeader).not.toContain('Moto (Cat. A)');
    expect(searchHeader).not.toContain("category: 'A'");
  });

  it('renders real public result data without fake avatars or fixed durations', () => {
    expect(providerCard).toContain('result.avatarUrl');
    expect(providerCard).toContain('Novo na MAZZI');
    expect(providerCard).toContain('const duration = primaryOffering?.durationMinutes');
    expect(providerCard).not.toContain('/ 50min');
    expect(providerCard).not.toContain('unsplash');
  });

  it('keeps search data on the public RPC and avoids private catalog loads', () => {
    expect(studentApp).toContain('dbService.searchPublicProviderResults');
    expect(studentApp).not.toContain('dbService.getProviders()');
    expect(studentApp).not.toContain('dbService.getVehicles()');
    expect(studentApp).not.toContain('dbService.getOfferings()');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/index.css', 'utf8');
const admin = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');

describe('app header brand icon parity', () => {
  it('uses the rounded landing treatment in Aluno and PRO headers', () => {
    expect(styles).toContain('.mazzi-brand-lockup > img { width: 44px; height: 44px;');
    expect(styles).toContain('border-radius: var(--radius-2xl); object-fit: cover;');
  });

  it('keeps the Admin brand icon at the same rounded size', () => {
    expect(admin).toContain('width="44"');
    expect(admin).toContain('height="44"');
    expect(admin).toContain('h-11 w-11 shrink-0 rounded-2xl object-cover');
  });
});

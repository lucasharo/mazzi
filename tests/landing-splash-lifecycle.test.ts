import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const landing = readFileSync('src/landing/LandingApp.tsx', 'utf8');

describe('landing splash lifecycle', () => {
  it('releases the browser splash after the landing surface mounts', () => {
    expect(landing).toContain("import { dismissInitialSplash } from '../lib/initial-splash';");
    expect(landing).toContain('dismissInitialSplash();');
  });
});

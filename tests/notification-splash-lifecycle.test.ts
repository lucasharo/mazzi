import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const splash = readFileSync('src/lib/initial-splash.ts', 'utf8');

describe('notification splash lifecycle', () => {
  it('does not cover a warm app after its initial navigation is ready', () => {
    expect(splash).toContain('let initialNavigationReady = false;');
    expect(splash).toContain('if (initialNavigationReady) return;');
    expect(splash).toContain('initialNavigationReady = true;');
  });
});

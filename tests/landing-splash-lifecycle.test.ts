import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const landing = readFileSync('src/landing/LandingApp.tsx', 'utf8');

describe('landing splash lifecycle', () => {
  it('releases the browser splash after the landing surface mounts', () => {
    expect(landing).toContain("import { dismissInitialSplash } from '../lib/initial-splash';");
    expect(landing).toContain('dismissInitialSplash();');
  });

  it('links APK downloads outside the Cloudflare Pages upload', () => {
    expect(landing).toContain('raw.githubusercontent.com/lucasharo/mazzi/feature/premium-ui-v2/artifacts/downloads');
    expect(landing).not.toContain("const studentApkUrl = '/downloads/mazzi-aluno.apk';");
  });
});

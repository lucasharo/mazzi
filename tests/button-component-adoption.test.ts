import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, 'src');
const allowedNativeButtonFiles = new Set([
  'src/components/ui/Button.tsx',
  // Leaflet popup markup is an HTML string mounted by Leaflet, outside React.
  'src/components/maps/LeafletMap.tsx',
]);

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? collectTsxFiles(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

describe('global button component adoption', () => {
  it('keeps native button elements inside the shared button boundary', () => {
    const violations = collectTsxFiles(sourceRoot)
      .map((path) => ({
        file: relative(projectRoot, path).replaceAll('\\', '/'),
        source: readFileSync(path, 'utf8'),
      }))
      .filter(({ file, source }) => !allowedNativeButtonFiles.has(file) && /<button\b/.test(source))
      .map(({ file }) => file);

    expect(violations).toEqual([]);
  });

  it('delegates primary and secondary wrappers to the global Button implementation', () => {
    const primary = readFileSync(join(sourceRoot, 'components/ui/PrimaryButton.tsx'), 'utf8');
    const secondary = readFileSync(join(sourceRoot, 'components/ui/SecondaryButton.tsx'), 'utf8');

    expect(primary).toContain("from './Button'");
    expect(secondary).toContain("from './Button'");
    expect(primary).not.toContain('<button');
    expect(secondary).not.toContain('<button');
  });
});

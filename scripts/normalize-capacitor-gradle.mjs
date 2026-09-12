import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target || !['android', 'android-pro'].includes(target)) {
  throw new Error('Uso: node scripts/normalize-capacitor-gradle.mjs <android|android-pro>');
}

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = [
  path.join(root, target, 'app', 'build.gradle'),
  path.join(root, target, 'capacitor-cordova-android-plugins', 'build.gradle'),
];

const flatDirBlock = /\r?\n\s*flatDir\s*\{\r?\n\s*dirs [^\r\n]+\r?\n\s*\}/g;

for (const file of files) {
  try {
    const source = await readFile(file, 'utf8');
    const normalized = source.replace(flatDirBlock, '');
    if (normalized !== source) await writeFile(file, normalized, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

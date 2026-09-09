import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_EMAIL_TEMPLATES = Object.freeze([
  'student-payment-confirmed.html',
  'student-cancellation-refund.html',
  'student-refund-completed.html',
  'pro-booking-confirmed.html',
  'pro-payout-completed.html',
]);

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function syncEmailTemplates({
  sourceDir = resolve(projectRoot, 'emails'),
  destinationDir = resolve(projectRoot, 'supabase/functions/_shared/email/templates'),
} = {}) {
  const sourceNames = new Set(await readdir(sourceDir));
  const missing = REQUIRED_EMAIL_TEMPLATES.filter((name) => !sourceNames.has(name));
  if (missing.length > 0) throw new Error(`Missing required email template(s): ${missing.join(', ')}`);

  await Promise.all(REQUIRED_EMAIL_TEMPLATES.map(async (name) => {
    const sourcePath = resolve(sourceDir, name);
    const sourceInfo = await stat(sourcePath);
    if (!sourceInfo.isFile()) throw new Error(`Email template is not a file: ${name}`);
  }));

  await mkdir(destinationDir, { recursive: true });
  for (const name of REQUIRED_EMAIL_TEMPLATES) {
    await copyFile(resolve(sourceDir, name), resolve(destinationDir, name));
  }
  return { sourceDir, destinationDir, files: [...REQUIRED_EMAIL_TEMPLATES] };
}

const invokedPath = process.argv[1] && resolve(isAbsolute(process.argv[1]) ? process.argv[1] : resolve(process.cwd(), process.argv[1]));
if (invokedPath === fileURLToPath(import.meta.url)) {
  syncEmailTemplates()
    .then(({ destinationDir, files }) => {
      console.log(`Synchronized ${files.length} email templates to ${destinationDir}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

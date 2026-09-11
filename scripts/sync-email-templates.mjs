import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_EMAIL_TEMPLATES = Object.freeze([
  'student-payment-confirmed.html',
  'student-cancellation-refund.html',
  'student-refund-completed.html',
  'pro-booking-confirmed.html',
  'pro-payout-completed.html',
]);

const RUNTIME_SOURCES = Object.freeze({
  'student-payment-confirmed.html': {
    file: 'supabase/functions/_shared/email/student-payment-confirmed-source.ts',
    exportName: 'studentPaymentConfirmedEmailTemplate',
  },
  'student-cancellation-refund.html': {
    file: 'supabase/functions/_shared/email/email-template-sources-v6.ts',
    exportName: 'studentCancellationRefundEmailTemplate',
  },
  'student-refund-completed.html': {
    file: 'supabase/functions/_shared/email/email-template-sources-v6.ts',
    exportName: 'studentRefundCompletedEmailTemplate',
  },
  'pro-booking-confirmed.html': {
    file: 'supabase/functions/_shared/email/email-template-sources-v6.ts',
    exportName: 'proBookingConfirmedEmailTemplate',
  },
  'pro-payout-completed.html': {
    file: 'supabase/functions/_shared/email/email-template-sources-v6.ts',
    exportName: 'proPayoutCompletedEmailTemplate',
  },
});

function toAsciiHtml(html) {
  return html.replace(/[^\x00-\x7F]/g, (character) => `&#${character.codePointAt(0)};`);
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalSourceDir = resolve(projectRoot, 'emails');

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

  // Tests intentionally use temporary source and destination directories.
  // Never let those fixtures overwrite the real Edge Function runtime sources.
  if (resolve(sourceDir) === canonicalSourceDir) {
    const runtimeSources = new Map();
    for (const name of REQUIRED_EMAIL_TEMPLATES) {
      const source = RUNTIME_SOURCES[name];
      const html = toAsciiHtml(await readFile(resolve(sourceDir, name), 'utf8'));
      const entries = runtimeSources.get(source.file) ?? [];
      entries.push(`export const ${source.exportName} = ${JSON.stringify(html)};`);
      runtimeSources.set(source.file, entries);
    }
    for (const [file, entries] of runtimeSources) {
      const target = resolve(projectRoot, file);
      await writeFile(target, `${entries.join('\n\n')}\n`, 'utf8');
    }
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

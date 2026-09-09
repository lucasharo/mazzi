export interface EmailRuntimeConfig {
  studentAppUrl: string;
  proAppUrl: string;
  logoUrl: string;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = (env[name] || '').trim();
  if (!value) throw new Error(`EMAIL_CONFIG_MISSING:${name}`);
  return value;
}

function httpsBaseUrl(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`EMAIL_CONFIG_INVALID_URL:${name}`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(`EMAIL_CONFIG_INVALID_URL:${name}`);
  }
  return value.replace(/\/$/, '');
}

export function readEmailRuntimeConfig(env: Record<string, string | undefined>): EmailRuntimeConfig {
  return {
    studentAppUrl: httpsBaseUrl(required(env, 'MAZZI_STUDENT_APP_URL'), 'MAZZI_STUDENT_APP_URL'),
    proAppUrl: httpsBaseUrl(required(env, 'MAZZI_PRO_APP_URL'), 'MAZZI_PRO_APP_URL'),
    logoUrl: httpsBaseUrl(required(env, 'MAZZI_EMAIL_LOGO_URL'), 'MAZZI_EMAIL_LOGO_URL'),
  };
}

function publicPath(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function buildEmailUrls(config: EmailRuntimeConfig, references: {
  bookingReference?: string;
  paymentReference?: string;
  payoutReference?: string;
}) {
  const bookingPath = references.bookingReference ? publicPath(config.studentAppUrl, `aulas/${references.bookingReference}`) : undefined;
  return {
    logo: config.logoUrl,
    studentLesson: bookingPath,
    proLesson: references.bookingReference ? publicPath(config.proAppUrl, `aulas/${references.bookingReference}`) : undefined,
    refundDetails: references.paymentReference ? publicPath(config.studentAppUrl, `reembolsos/${references.paymentReference}`) : undefined,
    earnings: references.payoutReference ? publicPath(config.proAppUrl, `ganhos/${references.payoutReference}`) : undefined,
  };
}

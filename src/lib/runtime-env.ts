// ============================================================================
// MAZZI PLATFORM — RUNTIME ENVIRONMENT SAFETY HELPERS
// ============================================================================

type RuntimeEnv = Record<string, string | boolean | undefined>;

function getImportMetaEnv(): RuntimeEnv {
  return ((import.meta as ImportMeta & { env?: RuntimeEnv }).env || {}) as RuntimeEnv;
}

export function getRuntimeEnvValue(key: string): string | undefined {
  if (typeof process !== 'undefined') {
    const nodeValue = process.env?.[key];
    if (typeof nodeValue === 'string') return nodeValue;
  }

  const viteEnv = getImportMetaEnv();
  const viteValue = viteEnv[key];
  if (typeof viteValue === 'string') return viteValue;

  return undefined;
}

export function isProductionRuntime(): boolean {
  const viteEnv = getImportMetaEnv();
  return (
    viteEnv.PROD === true ||
    viteEnv.MODE === 'production' ||
    getRuntimeEnvValue('NODE_ENV') === 'production'
  );
}

export function isDevelopmentRuntime(): boolean {
  const viteEnv = getImportMetaEnv();
  return viteEnv.DEV === true || getRuntimeEnvValue('NODE_ENV') === 'development';
}

export interface CanUseMockValidationPaymentOptions {
  isProduction: boolean;
  paymentMode?: string;
}

export function canUseMockValidationPayment(options: CanUseMockValidationPaymentOptions): boolean {
  if (!options.isProduction) {
    return true;
  }
  const mode = (options.paymentMode || '').trim().toUpperCase();
  return mode === 'MOCK_VALIDATION';
}

export function isMockValidationPaymentAllowed(): boolean {
  return canUseMockValidationPayment({
    isProduction: isProductionRuntime(),
    paymentMode: getRuntimeEnvValue('VITE_PAYMENT_MODE') || getRuntimeEnvValue('PAYMENT_MODE'),
  });
}

export function assertFrontendSafeSupabaseEnv(): void {
  const env = getImportMetaEnv();
  const hasBrowserServiceRole =
    typeof env.VITE_SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    env.VITE_SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;
  const hasBrowserSecretKey = typeof env.VITE_SUPABASE_SECRET_KEY === 'string' && env.VITE_SUPABASE_SECRET_KEY.trim().length > 0;

  if (hasBrowserServiceRole || hasBrowserSecretKey) {
    throw new Error('SECURITY_VIOLATION: privileged Supabase keys must never be exposed to the frontend.');
  }
}

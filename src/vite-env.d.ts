interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly VITE_APP_ENV?: string;
  readonly VITE_PAYMENT_GATEWAY_PROVIDER?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly VITE_ENABLE_DEV_QUICK_LOGIN?: string;
  readonly VITE_GEOAPIFY_API_KEY?: string;
  readonly VITE_STUDENT_APP_URL?: string;
  readonly VITE_PROVIDER_APP_URL?: string;
  readonly VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD?: string;
  readonly VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD?: string;
  readonly VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD?: string;
  readonly VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

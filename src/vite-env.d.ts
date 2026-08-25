interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly MODE: string;
  readonly VITE_ENABLE_DEV_QUICK_LOGIN?: string;
  readonly VITE_GEOAPIFY_API_KEY?: string;
  readonly VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD?: string;
  readonly VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD?: string;
  readonly VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD?: string;
  readonly VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

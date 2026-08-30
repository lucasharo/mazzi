import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appTarget = mode === 'student' || mode === 'instructor' || mode === 'admin' || mode === 'landing' ? mode : '';
  const appEntrypoint = appTarget ? `/src/entrypoints/${appTarget}/main.tsx` : '/src/main.tsx';
  const appOutDir = appTarget ? `dist/${appTarget}` : 'dist';

  const base = process.env.GITHUB_PAGES_DEPLOY === 'true'
    ? (appTarget === 'student' ? '/mazzi-student/' : appTarget === 'instructor' ? '/mazzi-pro/' : appTarget === 'admin' ? '/mazzi-admin/' : '/')
    : '/';

  const appManifest = appTarget === 'student'
    ? '/manifest.student.webmanifest'
    : appTarget === 'instructor'
      ? '/manifest.instructor.webmanifest'
      : appTarget === 'admin'
        ? '/manifest.admin.webmanifest'
        : appTarget === 'landing'
          ? '/manifest.landing.webmanifest'
          : '/manifest.webmanifest';

  const finalManifest = appManifest && appManifest.startsWith('/')
    ? `${base}${appManifest.slice(1)}`
    : appManifest;

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    base,
    plugins: [react(), tailwindcss(), {
      name: 'mazzi-mode-entrypoint',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const withEntrypoint = html.replace(/<script type="module" src="[^"]+"><\/script>/, `<script type="module" src="${appEntrypoint}"></script>`);
          return finalManifest
            ? withEntrypoint.replace(/<link rel="manifest" href="[^"]+"\s*\/>/g, '').replace('</head>', `<link rel="manifest" href="${finalManifest}"/></head>`)
            : withEntrypoint.replace(/<link rel="manifest" href="[^"]+"\s*\/>/g, '');
        },
      },
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_PAYMENT_GATEWAY_PROVIDER': JSON.stringify(env.VITE_PAYMENT_GATEWAY_PROVIDER || env.PAYMENT_GATEWAY_PROVIDER || 'fake'),
      'import.meta.env.VITE_ENABLE_DEV_QUICK_LOGIN': process.env.GITHUB_PAGES_DEPLOY === 'true' ? JSON.stringify('false') : JSON.stringify(env.VITE_ENABLE_DEV_QUICK_LOGIN || 'true'),
      'import.meta.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD': process.env.GITHUB_PAGES_DEPLOY === 'true' ? JSON.stringify('') : JSON.stringify(env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD || ''),
      'import.meta.env.VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD': process.env.GITHUB_PAGES_DEPLOY === 'true' ? JSON.stringify('') : JSON.stringify(env.VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD || ''),
      'import.meta.env.VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD': process.env.GITHUB_PAGES_DEPLOY === 'true' ? JSON.stringify('') : JSON.stringify(env.VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD || ''),
      'import.meta.env.VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD': process.env.GITHUB_PAGES_DEPLOY === 'true' ? JSON.stringify('') : JSON.stringify(env.VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD || ''),
    },
    server: {
      port: Number(env.VITE_APP_PORT || (appTarget === 'student' ? 3001 : appTarget === 'instructor' ? 3002 : appTarget === 'admin' ? 3003 : appTarget === 'landing' ? 3005 : 3000)),
      strictPort: Boolean(appTarget),
      // Permite visualizar o servidor local por um Quick Tunnel do Cloudflare.
      // O curinga é restrito ao domínio temporário de desenvolvimento.
      allowedHosts: ['.trycloudflare.com'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: appOutDir,
      emptyOutDir: true,
      rollupOptions: { input: 'index.html' },
    },
  };
});

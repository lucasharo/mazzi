import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
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
          // In local DEV, an old PWA service worker can intercept the source
          // modules before React starts. Clear that cache before importing the
          // entrypoint so a stale React/ReactDOM pair cannot survive a reload.
          const entrypointScript = command === 'serve'
            ? `<script type="module">
      (async () => {
        const isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (isLocalDev && 'serviceWorker' in navigator) {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.filter((name) => name.startsWith('mazzi-public-assets-')).map((name) => caches.delete(name)));
          } catch {
            // The app can still boot from the network if browser storage is unavailable.
          }
        }
        await import(${JSON.stringify(appEntrypoint)});
      })();
    </script>`
            : `<script type="module" src="${appEntrypoint}"></script>`;
          // Replace only the application's source entrypoint. Vite injects its
          // React Refresh and HMR scripts before this hook's output; matching
          // the first module script would leave the original app script in
          // place and the cleanup bootstrap would never run.
          const withEntrypoint = html.replace(
            /<script type="module" src="(?:\/src\/main\.tsx|\/index\.html\?html-proxy[^"]*)"><\/script>/,
            entrypointScript,
          );
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
      // Keep React and its renderer on the exact same module instance during
      // HMR and when multiple app entrypoints share this workspace.
      dedupe: ['react', 'react-dom'],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
      // Never let automated DOM tests initialize a real payment SDK.
      'import.meta.env.VITE_PAYMENT_GATEWAY_PROVIDER': JSON.stringify(mode === 'test' ? 'fake' : (env.VITE_PAYMENT_GATEWAY_PROVIDER || env.PAYMENT_GATEWAY_PROVIDER || 'fake')),
      'import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY': JSON.stringify(env.VITE_STRIPE_PUBLISHABLE_KEY || env.STRIPE_PUBLISHABLE_KEY || ''),
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

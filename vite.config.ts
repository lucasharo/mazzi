import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appTarget = mode === 'student' || mode === 'instructor' || mode === 'admin' ? mode : '';
  const appEntrypoint = appTarget ? `/src/entrypoints/${appTarget}/main.tsx` : '/src/main.tsx';
  const appOutDir = appTarget ? `dist/${appTarget}` : 'dist';
  const appManifest = appTarget === 'student' ? '/manifest.student.webmanifest' : appTarget === 'instructor' ? '/manifest.instructor.webmanifest' : appTarget === 'admin' ? '' : '/manifest.webmanifest';
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), tailwindcss(), {
      name: 'mazzi-mode-entrypoint',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          const withEntrypoint = html.replace(/<script type="module" src="[^"]+"><\/script>/, `<script type="module" src="${appEntrypoint}"></script>`);
          return appManifest
            ? withEntrypoint.replace(/<link rel="manifest" href="[^"]+"\s*\/>/g, '').replace('</head>', `<link rel="manifest" href="${appManifest}"/></head>`)
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
    },
    server: {
      port: Number(env.VITE_APP_PORT || (appTarget === 'student' ? 3001 : appTarget === 'instructor' ? 3002 : appTarget === 'admin' ? 3003 : 3000)),
      strictPort: Boolean(appTarget),
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

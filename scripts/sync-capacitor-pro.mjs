import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const capacitorCli = fileURLToPath(new URL('../node_modules/@capacitor/cli/bin/capacitor', import.meta.url));

const child = spawn(process.execPath, [capacitorCli, 'sync', 'android'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: {
    ...process.env,
    MAZZI_CAPACITOR_TARGET: 'pro',
  },
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error('Falha ao iniciar a sincronização do Android PRO:', error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Sincronização do Android PRO interrompida por ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});

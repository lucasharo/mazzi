import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { StudentRoot } from './StudentRoot';
import { registerServiceWorker } from '../../registerServiceWorker.ts';
import '../../index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><StudentRoot /></ErrorBoundary></StrictMode>);

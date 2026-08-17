import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { AdminRoot } from './AdminRoot';
import '../../index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><AdminRoot /></ErrorBoundary></StrictMode>);

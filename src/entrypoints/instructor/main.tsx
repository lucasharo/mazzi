import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { InstructorRoot } from './InstructorRoot';
import '../../index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><InstructorRoot /></ErrorBoundary></StrictMode>);

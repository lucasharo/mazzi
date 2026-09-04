import React from 'react';
import { X } from 'lucide-react';
import { EnvironmentBadge } from './EnvironmentBadge';
import { IconButton } from './IconButton';
import '../instant/instant-wizard.css';

interface Props {
  steps: string[];
  current: string;
  title: string;
  onClose: () => void;
}

export function LessonWizardHeader({ steps, current, title, onClose }: Props) {
  const currentIndex = Math.max(0, steps.indexOf(current));
  return <header className="mb-5 space-y-5">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><img src="/brand/mazzi-mark-transparent.png" alt="" className="h-8 w-8 object-contain" /><span className="text-2xl font-extrabold tracking-tight">MAZZI</span></div>
      <div className="flex shrink-0 items-center gap-2"><EnvironmentBadge /><IconButton label="Fechar diálogo" onClick={onClose} className="rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-[var(--mazzi-dark)] transition-colors"><X className="h-4 w-4" aria-hidden="true" /></IconButton></div>
    </div>
    <ol className="flex pt-1" aria-label="Etapas da reserva">
      {steps.map((step, index) => <li key={step} aria-current={index === currentIndex ? 'step' : undefined}
        className={`relative h-1.5 flex-1 first:rounded-l-full last:rounded-r-full before:absolute before:-top-1 before:left-0 before:h-3.5 before:w-3.5 before:rounded-full before:bg-inherit ${index <= currentIndex ? 'bg-[var(--mazzi-yellow)]' : 'bg-slate-200'}`}><span className="sr-only">{step}</span></li>)}
    </ol>
    <h2 className="text-2xl font-extrabold text-slate-950">{title}</h2>
  </header>;
}

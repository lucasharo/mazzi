import React from 'react';

/** Keep this sibling of the scrollable body, inside a height-constrained flex column. */
export function WizardActionFooter({ children }: { children: React.ReactNode }) {
  return <div data-component="wizard-action-footer" className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white pt-4 pb-[env(safe-area-inset-bottom)] [&_button]:min-h-12">
    {children}
  </div>;
}

/**
 * Legacy playground entrypoint.
 * Production builds use the independent StudentRoot, InstructorRoot and
 * AdminRoot entrypoints; this component intentionally has no global shell.
 */
import React from 'react';

export default function LegacyApp(): React.ReactElement {
  return <main className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-100 p-6 text-center text-slate-700">
    <p>Selecione um entrypoint MAZZI: Student (3001), Instructor (3002) ou Admin (3003).</p>
  </main>;
}

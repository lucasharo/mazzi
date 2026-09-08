import type { ReactNode } from 'react';

interface ProfileDetailsCardProps {
  children: ReactNode;
}

/** Shared read-only profile card shell used by the Student and PRO apps. */
export function ProfileDetailsCard({ children }: ProfileDetailsCardProps) {
  return (
    <div className="mazzi-compact-card rounded-2xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs [&>dl]:mt-4 [&>dl]:space-y-2 [&>dl]:text-sm">
      <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Dados do perfil</h4>
      {children}
    </div>
  );
}

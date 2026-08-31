import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ProfileSectionHeaderProps {
  title: string;
  icon: LucideIcon;
  badge?: ReactNode;
  badgeClassName?: string;
}

export function ProfileSectionHeader({
  title,
  icon: Icon,
  badge,
  badgeClassName,
}: ProfileSectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--mazzi-border)] pb-2">
      <div className="flex min-w-0 items-center gap-2 text-[var(--mazzi-dark)]">
        <Icon className="h-4 w-4 shrink-0 text-[var(--mazzi-muted)]" aria-hidden="true" />
        <span className="mazzi-field-label text-[var(--mazzi-dark)]">{title}</span>
      </div>
      {badge && (
        <span className={badgeClassName || 'shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600'}>
          {badge}
        </span>
      )}
    </div>
  );
}

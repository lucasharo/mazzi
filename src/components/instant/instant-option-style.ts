/** Shared appearance for transmission and price choices in Aula Agora. */
export function instantOptionClassName(selected: boolean): string {
  return `flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${selected ? 'border-[var(--mazzi-yellow)] bg-amber-50 text-[var(--mazzi-dark)] shadow-sm' : 'border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] text-slate-700 hover:border-amber-300'} disabled:cursor-not-allowed disabled:opacity-60`;
}

/** Shared appearance for transmission and price choices in Aula Agora. */
export function instantOptionClassName(selected: boolean): string {
  return `flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 ease-out active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mazzi-dark)] focus-visible:ring-2 focus-visible:ring-[var(--mazzi-focus-glow)] ${selected ? 'border-[var(--mazzi-yellow)] bg-amber-50 text-[var(--mazzi-dark)] shadow-sm' : 'border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] text-slate-700 shadow-xs hover:border-amber-300 hover:bg-white hover:shadow-sm'} disabled:cursor-not-allowed disabled:opacity-60`;
}

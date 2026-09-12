const MOJIBAKE_MARKERS = /[ÃÂâð�]/;

/** Repairs text that was decoded as Windows-1252/Latin-1 before reaching the UI. */
export function repairMojibake(value: unknown): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (!MOJIBAKE_MARKERS.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return repaired && repaired !== text && repaired.match(MOJIBAKE_MARKERS)?.length !== text.match(MOJIBAKE_MARKERS)?.length
      ? repaired
      : text;
  } catch {
    return text;
  }
}

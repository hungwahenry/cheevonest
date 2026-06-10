/** Truncate user content for push/mail previews. */
export function limit(value: string | null, max: number): string {
  if (value === null) {
    return '';
  }

  return value.length > max ? `${value.slice(0, max - 1)}\u2026` : value;
}

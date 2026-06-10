/** Safe stringification for untyped provider JSON — objects fall back instead of "[object Object]". */
export function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return fallback;
}

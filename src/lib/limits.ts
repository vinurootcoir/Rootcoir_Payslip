export const EMAIL_ACTION_LIMIT = 30;
export const EMAIL_ACTION_WINDOW_MS = 15 * 60 * 1000;

export function isOverWindowLimit(count: number, limit = EMAIL_ACTION_LIMIT): boolean {
  return count >= limit;
}

const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60;

/** Parses values such as 30s, 15m, 12h, and 7d. Caps the session at 30 days. */
export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error("Session duration is invalid");
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  const seconds = amount * multiplier;

  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > MAX_SESSION_SECONDS) {
    throw new Error("Session duration is outside the allowed range");
  }

  return seconds;
}

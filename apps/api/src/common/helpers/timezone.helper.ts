/**
 * Timezone utility helpers used across all modules for scheduling and display.
 */

/**
 * Validates that a string is a valid IANA timezone.
 * Uses Intl.DateTimeFormat which throws for invalid timezones.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a UTC Date to a localized string in the given timezone.
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  locale = "id-ID",
): string {
  return date.toLocaleString(locale, { timeZone: timezone });
}

/**
 * Gets the current time as a Date object.
 * The timezone parameter is for contextual awareness — the returned Date
 * is always UTC internally. Use formatInTimezone() for display purposes.
 */
export function nowInTimezone(_timezone: string): Date {
  return new Date();
}

/**
 * Formats a Date to a time-only string in the given timezone (HH:mm format).
 */
export function formatTimeInTimezone(
  date: Date,
  timezone: string,
  locale = "id-ID",
): string {
  return date.toLocaleTimeString(locale, {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a Date to a date-only string in the given timezone.
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  locale = "id-ID",
): string {
  return date.toLocaleDateString(locale, { timeZone: timezone });
}

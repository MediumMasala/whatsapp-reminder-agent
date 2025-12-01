/**
 * Time Service
 *
 * Centralized service for handling all time-related operations
 * with proper timezone support for Asia/Kolkata
 */
export class TimeService {
  private readonly timezone = 'Asia/Kolkata';
  private readonly timezoneOffsetMinutes = 330; // UTC+5:30 = 330 minutes

  /**
   * Get current date/time in Kolkata timezone
   */
  getCurrentKolkataTime(): Date {
    const now = new Date();
    return now;
  }

  /**
   * Get current date/time components in Kolkata timezone
   */
  getCurrentKolkataComponents(): {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    const now = new Date();
    const kolkataString = now.toLocaleString('en-US', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Parse: "MM/DD/YYYY, HH:MM:SS"
    const [datePart, timePart] = kolkataString.split(', ');
    const [month, day, year] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);

    return {
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
    };
  }

  /**
   * Create a Date object for a specific time today in Kolkata timezone
   *
   * @param hours - Hour in 24-hour format (0-23)
   * @param minutes - Minutes (0-59)
   * @param daysFromNow - Days from now (0 = today, 1 = tomorrow, etc.)
   * @returns Date object representing that time
   */
  createKolkataDateTime(hours: number, minutes: number, daysFromNow: number = 0): Date {
    const current = this.getCurrentKolkataComponents();

    // Create a date object for today in Kolkata timezone
    // We'll construct it as if we're in UTC, then adjust for timezone
    const targetDate = new Date(Date.UTC(
      current.year,
      current.month - 1, // JS months are 0-indexed
      current.day + daysFromNow,
      hours,
      minutes,
      0,
      0
    ));

    // Subtract the Kolkata offset to convert to UTC
    // Kolkata is UTC+5:30, so we subtract 330 minutes to get UTC
    targetDate.setMinutes(targetDate.getMinutes() - this.timezoneOffsetMinutes);

    return targetDate;
  }

  /**
   * Check if a given time (hours:minutes) is in the past for today in Kolkata
   *
   * @param hours - Hour in 24-hour format
   * @param minutes - Minutes
   * @returns true if the time has already passed today
   */
  isTimeInPastToday(hours: number, minutes: number): boolean {
    const current = this.getCurrentKolkataComponents();

    // Compare hours and minutes
    if (hours < current.hours) {
      return true;
    }
    if (hours === current.hours && minutes <= current.minutes) {
      return true;
    }

    return false;
  }

  /**
   * Format a Date object to a human-readable string in Kolkata timezone
   *
   * @param date - Date to format
   * @returns Formatted string like "Today at 7:05 PM" or "Tomorrow at 3:00 PM"
   */
  formatKolkataDateTime(date: Date): string {
    const dateStr = date.toLocaleDateString('en-US', {
      timeZone: this.timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const timeStr = date.toLocaleTimeString('en-US', {
      timeZone: this.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const current = this.getCurrentKolkataComponents();
    const targetComponents = this.getKolkataComponents(date);

    // Check if it's today
    if (
      current.year === targetComponents.year &&
      current.month === targetComponents.month &&
      current.day === targetComponents.day
    ) {
      return `Today at ${timeStr}`;
    }

    // Check if it's tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowComponents = this.getKolkataComponents(tomorrow);

    if (
      tomorrowComponents.year === targetComponents.year &&
      tomorrowComponents.month === targetComponents.month &&
      tomorrowComponents.day === targetComponents.day
    ) {
      return `Tomorrow at ${timeStr}`;
    }

    return `${dateStr} at ${timeStr}`;
  }

  /**
   * Get date/time components for any Date object in Kolkata timezone
   */
  private getKolkataComponents(date: Date): {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
  } {
    const kolkataString = date.toLocaleString('en-US', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const [datePart, timePart] = kolkataString.split(', ');
    const [month, day, year] = datePart.split('/').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    return { year, month, day, hours, minutes };
  }
}

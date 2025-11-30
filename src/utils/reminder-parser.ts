import { ParsedReminder } from '../types';
import { env } from '../config/env';

/**
 * Natural language reminder parser
 * Supports patterns like:
 * - "remind me at 7pm to pay rent"
 * - "tomorrow at 10am - call doctor"
 * - "pay bills at 5pm"
 * - "tomorrow morning meeting"
 */
export class ReminderParser {
  constructor(_timezone: string = env.DEFAULT_TIMEZONE) {
    // Timezone stored for potential future use
  }

  /**
   * Parse a message and extract reminder details
   */
  parse(message: string): ParsedReminder | null {
    const lowerMessage = message.toLowerCase().trim();

    // Time patterns
    const timeMatch = this.extractTime(lowerMessage);
    if (!timeMatch) {
      return null;
    }

    // Date patterns (today, tomorrow, or assume today)
    const dateMatch = this.extractDate(lowerMessage);

    // Combine date and time
    const scheduledTime = this.buildDateTime(dateMatch, timeMatch);

    // Extract the actual reminder text (remove time/date expressions)
    const reminderText = this.extractReminderText(message, timeMatch, dateMatch);

    return {
      text: reminderText,
      scheduledTime,
      confidence: 0.8,
      extractedData: {
        rawTimeExpression: timeMatch.raw,
        parsedDate: dateMatch?.raw,
        parsedTime: `${timeMatch.hours}:${timeMatch.minutes}`,
      },
    };
  }

  private extractTime(message: string): {
    hours: number;
    minutes: number;
    raw: string;
  } | null {
    // Pattern: 7pm, 7:30pm, 07:30, 19:30
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2})\s*(am|pm)/i,
      /(\d{1,2}):(\d{2})/,
      /(morning|afternoon|evening|night)/i,
    ];

    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        return this.parseTimeMatch(match);
      }
    }

    return null;
  }

  private parseTimeMatch(match: RegExpMatchArray): {
    hours: number;
    minutes: number;
    raw: string;
  } {
    const raw = match[0];

    // Named times
    if (/morning/i.test(raw)) {
      return { hours: 9, minutes: 0, raw };
    }
    if (/afternoon/i.test(raw)) {
      return { hours: 14, minutes: 0, raw };
    }
    if (/evening/i.test(raw)) {
      return { hours: 18, minutes: 0, raw };
    }
    if (/night/i.test(raw)) {
      return { hours: 21, minutes: 0, raw };
    }

    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3]?.toLowerCase();

    // Convert to 24-hour format
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }

    return { hours, minutes, raw };
  }

  private extractDate(message: string): {
    daysFromNow: number;
    raw: string;
  } | null {
    if (/tomorrow/i.test(message)) {
      return { daysFromNow: 1, raw: 'tomorrow' };
    }

    if (/today/i.test(message)) {
      return { daysFromNow: 0, raw: 'today' };
    }

    // Default to today
    return { daysFromNow: 0, raw: 'today' };
  }

  private buildDateTime(
    dateMatch: { daysFromNow: number } | null,
    timeMatch: { hours: number; minutes: number }
  ): Date {
    const now = new Date();
    const targetDate = new Date(now);

    // Add days
    if (dateMatch) {
      targetDate.setDate(targetDate.getDate() + dateMatch.daysFromNow);
    }

    // Set time
    targetDate.setHours(timeMatch.hours, timeMatch.minutes, 0, 0);

    // If time is in the past today, assume tomorrow
    if (targetDate < now && (!dateMatch || dateMatch.daysFromNow === 0)) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    return targetDate;
  }

  private extractReminderText(
    message: string,
    timeMatch: { raw: string },
    dateMatch: { raw: string } | null
  ): string {
    let text = message;

    // Remove time expression
    text = text.replace(new RegExp(timeMatch.raw, 'gi'), '');

    // Remove date expression
    if (dateMatch) {
      text = text.replace(new RegExp(dateMatch.raw, 'gi'), '');
    }

    // Remove common connecting words
    text = text
      .replace(/\b(remind me to|remind me|to|at|on|-)\b/gi, ' ')
      .trim();

    return text || 'Reminder';
  }

  /**
   * Check if a message looks like a reminder request
   */
  isReminderRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Check for reminder keywords
    const hasReminderKeyword = /remind|reminder/i.test(lowerMessage);

    // Check for time expressions
    const hasTimeExpression = this.extractTime(lowerMessage) !== null;

    return hasReminderKeyword || hasTimeExpression;
  }
}

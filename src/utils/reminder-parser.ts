import { ParsedReminder } from '../types';
import { TimeService } from '../services/time.service';

/**
 * Natural language reminder parser
 * Supports patterns like:
 * - "remind me at 7pm to pay rent"
 * - "tomorrow at 10am - call doctor"
 * - "pay bills at 5pm"
 * - "tomorrow morning meeting"
 */
export class ReminderParser {
  private timeService: TimeService;

  constructor() {
    this.timeService = new TimeService();
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
    // Pattern priorities:
    // 1. 12-hour with AM/PM: 7pm, 7:30pm, 1pm, 12:30am
    // 2. 24-hour format: 13:00, 14:30, 19:00, 20:15
    // 3. Named times: morning, afternoon, evening, night
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,    // 7:30pm, 1:15am
      /(\d{1,2})\s*(am|pm)/i,            // 7pm, 1am, 12pm
      /\b([0-2]?[0-9]):([0-5][0-9])\b/,  // 13:00, 14:30, 9:30 (24-hour or general)
      /\b([01]?[0-9]|2[0-3])\b/,         // 13, 14, 20 (24-hour single digit)
      /(morning|afternoon|evening|night)/i,
    ];

    for (const pattern of timePatterns) {
      const match = message.match(pattern);
      if (match) {
        const result = this.parseTimeMatch(match);
        if (result && result.hours >= 0 && result.hours < 24) {
          return result;
        }
      }
    }

    return null;
  }

  private parseTimeMatch(match: RegExpMatchArray): {
    hours: number;
    minutes: number;
    raw: string;
  } | null {
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

    // Validate minutes
    if (minutes < 0 || minutes > 59) {
      return null;
    }

    // Handle 12-hour format with AM/PM
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }

    // Validate hours (0-23 for 24-hour format)
    if (hours < 0 || hours > 23) {
      return null;
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
    // Determine how many days from now
    let daysFromNow = 0;

    if (dateMatch && dateMatch.daysFromNow > 0) {
      // Explicit "tomorrow" or other future date
      daysFromNow = dateMatch.daysFromNow;
    } else if (!dateMatch || dateMatch.daysFromNow === 0) {
      // Check if time is in the past for today
      if (this.timeService.isTimeInPastToday(timeMatch.hours, timeMatch.minutes)) {
        // If time has passed today, schedule for tomorrow
        daysFromNow = 1;
      }
    }

    // Use TimeService to create the proper date
    return this.timeService.createKolkataDateTime(
      timeMatch.hours,
      timeMatch.minutes,
      daysFromNow
    );
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

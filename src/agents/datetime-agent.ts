import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { BaseAgent } from './base-agent';
import { TimeService } from '../services/time.service';

/**
 * Parsed DateTime Result
 */
export interface ParsedDateTime {
  scheduledTime: Date;
  timeExpression: string;
  dateExpression?: string;
  confidence: number;
  metadata?: {
    hours: number;
    minutes: number;
    daysFromNow: number;
  };
}

/**
 * DateTime Agent
 *
 * Specialized agent for parsing and understanding date/time expressions:
 * - Parses natural language time expressions
 * - Handles relative dates (today, tomorrow, next week)
 * - Handles specific times (7pm, 14:30, morning)
 * - Returns structured DateTime objects
 * - Used by other agents for time-related operations
 */
export class DateTimeAgent extends BaseAgent implements IAgent {
  readonly type: AgentType = 'datetime';
  readonly name: string = 'DateTime Agent';
  private timeService: TimeService;

  constructor() {
    super();
    this.timeService = new TimeService();
  }

  /**
   * This is a utility agent - it doesn't directly handle user messages
   * Other agents call its parseDateTime method
   */
  async canHandle(_context: AgentContext): Promise<boolean> {
    return false;
  }

  /**
   * Not used for direct message handling
   */
  async handle(_context: AgentContext): Promise<AgentResponse> {
    return {
      message: 'DateTime agent is a utility agent - use parseDateTime() method instead',
    };
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Parses and understands date/time expressions in natural language';
  }

  /**
   * Parse a message and extract date/time information
   * This is the main method other agents should call
   */
  parseDateTime(message: string): ParsedDateTime | null {
    const lowerMessage = message.toLowerCase().trim();

    // Extract time
    const timeMatch = this.extractTime(lowerMessage);
    if (!timeMatch) {
      return null;
    }

    // Extract date
    const dateMatch = this.extractDate(lowerMessage);

    // Build the actual DateTime
    const scheduledTime = this.buildDateTime(dateMatch, timeMatch);

    return {
      scheduledTime,
      timeExpression: timeMatch.raw,
      dateExpression: dateMatch?.raw,
      confidence: 0.8,
      metadata: {
        hours: timeMatch.hours,
        minutes: timeMatch.minutes,
        daysFromNow: dateMatch?.daysFromNow || 0,
      },
    };
  }

  /**
   * Extract time from message
   */
  private extractTime(
    message: string
  ): { hours: number; minutes: number; raw: string } | null {
    // Pattern priorities:
    // 1. 12-hour with AM/PM: 7pm, 7:30pm, 1pm, 12:30am
    // 2. 24-hour format: 13:00, 14:30, 19:00, 20:15
    // 3. Named times: morning, afternoon, evening, night
    const timePatterns = [
      /(\\d{1,2}):(\\d{2})\\s*(am|pm)/i, // 7:30pm, 1:15am
      /(\\d{1,2})\\s*(am|pm)/i, // 7pm, 1am, 12pm
      /\\b([0-2]?[0-9]):([0-5][0-9])\\b/, // 13:00, 14:30, 9:30
      /\\b([01]?[0-9]|2[0-3])\\b/, // 13, 14, 20 (24-hour)
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

  /**
   * Parse a time match into hours and minutes
   */
  private parseTimeMatch(
    match: RegExpMatchArray
  ): { hours: number; minutes: number; raw: string } | null {
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

    // Validate hours
    if (hours < 0 || hours > 23) {
      return null;
    }

    return { hours, minutes, raw };
  }

  /**
   * Extract date from message
   */
  private extractDate(
    message: string
  ): { daysFromNow: number; raw: string } | null {
    // Tomorrow
    if (/tomorrow/i.test(message)) {
      return { daysFromNow: 1, raw: 'tomorrow' };
    }

    // Today
    if (/today/i.test(message)) {
      return { daysFromNow: 0, raw: 'today' };
    }

    // Day after tomorrow
    if (/day after tomorrow/i.test(message)) {
      return { daysFromNow: 2, raw: 'day after tomorrow' };
    }

    // In N days
    const inDaysMatch = message.match(/in (\\d+) days?/i);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      return { daysFromNow: days, raw: inDaysMatch[0] };
    }

    // Default to today
    return { daysFromNow: 0, raw: 'today' };
  }

  /**
   * Build a Date object from extracted date and time
   */
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

  /**
   * Check if a message contains time-related information
   */
  hasTimeExpression(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.extractTime(lowerMessage) !== null;
  }

  /**
   * Format a Date object to human-readable string
   */
  formatDateTime(date: Date): string {
    return this.timeService.formatKolkataDateTime(date);
  }
}

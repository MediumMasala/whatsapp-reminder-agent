import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { BaseAgent } from './base-agent';
import { ReminderParser } from '../utils/reminder-parser';
import { ReminderService } from '../services/reminder.service';
import { logger } from '../config/logger';

/**
 * Reminder Agent
 *
 * Handles all reminder-related functionality:
 * - Create reminders from natural language
 * - List upcoming reminders
 * - Cancel reminders
 * - Handle reminder confirmations
 */
export class ReminderAgent extends BaseAgent implements IAgent {
  readonly type: AgentType = 'reminder';
  readonly name: string = 'Reminder Agent';

  private reminderParser: ReminderParser;
  private reminderService: ReminderService;

  constructor() {
    super();
    this.reminderParser = new ReminderParser();
    this.reminderService = new ReminderService();
  }

  /**
   * Check if this agent should handle the message
   */
  async canHandle(context: AgentContext): Promise<boolean> {
    const message = context.message.toLowerCase().trim();

    // Explicit reminder commands
    if (/^(remind|reminder|set reminder|create reminder)/i.test(message)) {
      return true;
    }

    // Time expressions suggest reminder intent
    if (
      /\b(tomorrow|today|tonight|morning|evening|afternoon|night|am|pm|:\d{2}|\d{1,2}:\d{2})\b/i.test(
        message
      )
    ) {
      return true;
    }

    // List/view commands
    if (/^(list|show|view|my)\s*(reminders?)/i.test(message)) {
      return true;
    }

    // Cancel commands
    if (/^(cancel|delete|remove)\s*(reminder)?/i.test(message)) {
      return true;
    }

    return false;
  }

  /**
   * Handle reminder operations
   */
  async handle(context: AgentContext): Promise<AgentResponse> {
    const { user, message } = context;
    const lowerMessage = message.toLowerCase().trim();

    logger.info({ userId: user.id, message }, 'Reminder agent processing');

    // List reminders
    if (/^(list|show|view|my)\s*(reminders?)/i.test(lowerMessage)) {
      return await this.listReminders(user.phoneNumber, user.id);
    }

    // Cancel reminder
    if (/^(cancel|delete|remove)\s*(reminder)?/i.test(lowerMessage)) {
      return await this.handleCancelRequest(user.phoneNumber, user.id, message);
    }

    // Default: Create reminder
    return await this.createReminder(user.phoneNumber, user.id, message);
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Manages reminders with natural language understanding and smart scheduling';
  }

  /**
   * Create a new reminder
   */
  private async createReminder(
    phoneNumber: string,
    userId: string,
    message: string
  ): Promise<AgentResponse> {
    try {
      // Parse the reminder from natural language
      const parsed = this.reminderParser.parse(message);

      if (!parsed || !parsed.scheduledTime) {
        await this.sendMessage(
          phoneNumber,
          userId,
          "I couldn't figure out when you want to be reminded. Could you include a time? (e.g., 'tomorrow at 3pm' or 'tonight at 8')",
          { intent: 'reminder_time_unclear' }
        );
        return {
          message: '',
          metadata: { error: 'time_unclear' },
        };
      }

      if (!parsed.text || parsed.text.trim().length === 0) {
        await this.sendMessage(
          phoneNumber,
          userId,
          "What should I remind you about?",
          { intent: 'reminder_text_missing' }
        );
        return {
          message: '',
          metadata: { error: 'text_missing' },
        };
      }

      // Create the reminder
      const reminder = await this.reminderService.createReminder({
        userId,
        reminderText: parsed.text,
        scheduledTime: parsed.scheduledTime,
        metadata: {
          originalMessage: message,
          parsedData: parsed,
        },
      });

      // Format confirmation message
      const timeStr = new Date(parsed.scheduledTime).toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      const confirmMsg = `✅ Reminder set for ${timeStr}\n\n"${parsed.text}"`;

      await this.sendMessage(phoneNumber, userId, confirmMsg, {
        intent: 'reminder_created',
        relatedId: reminder.id,
      });

      logger.info({ userId, reminderId: reminder.id, scheduledTime: parsed.scheduledTime }, 'Reminder created');

      return {
        message: '',
        metadata: {
          reminderId: reminder.id,
          scheduledTime: parsed.scheduledTime,
        },
      };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to create reminder');

      await this.sendMessage(
        phoneNumber,
        userId,
        "Oops! Something went wrong while setting your reminder. Could you try again?",
        { intent: 'reminder_error' }
      );

      return {
        message: '',
        metadata: { error: 'creation_failed' },
      };
    }
  }

  /**
   * List all pending reminders
   */
  private async listReminders(phoneNumber: string, userId: string): Promise<AgentResponse> {
    try {
      const reminders = await this.reminderService.getUpcomingReminders(userId);

      if (reminders.length === 0) {
        await this.sendMessage(
          phoneNumber,
          userId,
          "You don't have any pending reminders. Want to set one?",
          { intent: 'reminder_list_empty' }
        );
        return { message: '' };
      }

      // Format reminders list
      const remindersList = reminders
        .map((reminder, index) => {
          const timeStr = new Date(reminder.scheduledTime).toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          return `${index + 1}. ${timeStr}\n   "${reminder.reminderText}"`;
        })
        .join('\n\n');

      const listMsg = `📋 Your upcoming reminders:\n\n${remindersList}\n\nTo cancel a reminder, just say "cancel reminder 1" (or the number you want to cancel).`;

      await this.sendMessage(phoneNumber, userId, listMsg, {
        intent: 'reminder_list',
      });

      return { message: '' };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to list reminders');

      await this.sendMessage(
        phoneNumber,
        userId,
        "Sorry, I couldn't fetch your reminders right now. Please try again.",
        { intent: 'reminder_list_error' }
      );

      return {
        message: '',
        metadata: { error: 'list_failed' },
      };
    }
  }

  /**
   * Handle cancel reminder request
   */
  private async handleCancelRequest(
    phoneNumber: string,
    userId: string,
    message: string
  ): Promise<AgentResponse> {
    try {
      // Extract reminder number
      const numbers = this.extractNumbers(message);

      if (numbers.length === 0) {
        // No number specified - show list and ask which one
        const reminders = await this.reminderService.getUpcomingReminders(userId);

        if (reminders.length === 0) {
          await this.sendMessage(
            phoneNumber,
            userId,
            "You don't have any reminders to cancel.",
            { intent: 'reminder_cancel_empty' }
          );
          return { message: '' };
        }

        const remindersList = reminders
          .map((reminder, index) => {
            const timeStr = new Date(reminder.scheduledTime).toLocaleString('en-US', {
              timeZone: 'Asia/Kolkata',
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            return `${index + 1}. ${timeStr} - "${reminder.reminderText}"`;
          })
          .join('\n');

        const askMsg = `Which reminder would you like to cancel?\n\n${remindersList}\n\nReply with the number (e.g., "cancel 1").`;

        await this.sendMessage(phoneNumber, userId, askMsg, {
          intent: 'reminder_cancel_ask',
        });

        return { message: '' };
      }

      // Get the reminder index (1-based from user, convert to 0-based)
      const index = numbers[0] - 1;
      const reminders = await this.reminderService.getUpcomingReminders(userId);

      if (index < 0 || index >= reminders.length) {
        await this.sendMessage(
          phoneNumber,
          userId,
          `You don't have a reminder #${numbers[0]}. You have ${reminders.length} reminder(s).`,
          { intent: 'reminder_cancel_invalid' }
        );
        return { message: '' };
      }

      // Cancel the reminder
      const reminder = reminders[index];
      await this.reminderService.cancelReminder(reminder.id);

      const cancelMsg = `✅ Cancelled: "${reminder.reminderText}"`;

      await this.sendMessage(phoneNumber, userId, cancelMsg, {
        intent: 'reminder_cancelled',
        relatedId: reminder.id,
      });

      logger.info({ userId, reminderId: reminder.id }, 'Reminder cancelled');

      return {
        message: '',
        metadata: {
          reminderId: reminder.id,
          action: 'cancelled',
        },
      };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to cancel reminder');

      await this.sendMessage(
        phoneNumber,
        userId,
        "Sorry, I couldn't cancel that reminder. Please try again.",
        { intent: 'reminder_cancel_error' }
      );

      return {
        message: '',
        metadata: { error: 'cancel_failed' },
      };
    }
  }
}

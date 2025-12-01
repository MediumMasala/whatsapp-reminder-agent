import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { BaseAgent } from './base-agent';
import { DateTimeAgent } from './datetime-agent';
import { ReminderAgent, ReminderData } from './reminder-agent';
import { ReminderQueue } from '../jobs/reminder-queue';
import { logger } from '../config/logger';

/**
 * Conversation / Orchestrator Agent
 *
 * This is the MAIN AGENT after onboarding.
 * Responsibilities:
 * - Detect user intent (create/edit/delete/list reminders, help, small talk)
 * - For reminder operations:
 *   - Extract task and time from message
 *   - Ask follow-up questions if needed
 *   - Use DateTimeAgent to parse time expressions
 *   - Use ReminderAgent (storage) to save/update/delete
 *   - Confirm to user in plain language
 * - Handle reminder due notifications
 * - General conversation and help
 */
export class ConversationAgent extends BaseAgent implements IAgent {
  readonly type: AgentType = 'conversation';
  readonly name: string = 'Conversation Agent';

  private dateTimeAgent: DateTimeAgent;
  private reminderAgent: ReminderAgent;
  private reminderQueue: ReminderQueue;

  constructor() {
    super();
    this.dateTimeAgent = new DateTimeAgent();
    this.reminderAgent = new ReminderAgent();
    this.reminderQueue = new ReminderQueue();
  }

  /**
   * This agent handles ALL messages after onboarding
   */
  async canHandle(_context: AgentContext): Promise<boolean> {
    // This is the default agent - always returns true
    return true;
  }

  /**
   * Handle all user messages
   */
  async handle(context: AgentContext): Promise<AgentResponse> {
    const { user, message } = context;
    const lowerMessage = message.toLowerCase().trim();

    logger.info({ userId: user.id, message }, 'Conversation agent handling message');

    // Detect intent
    const intent = this.detectIntent(lowerMessage);

    switch (intent) {
      case 'create_reminder':
        return await this.handleCreateReminder(user.phoneNumber, user.id, user.name, message);

      case 'list_reminders':
        return await this.handleListReminders(user.phoneNumber, user.id, user.name);

      case 'delete_reminder':
        return await this.handleDeleteReminder(user.phoneNumber, user.id, user.name, message);

      case 'help':
        return await this.handleHelp(user.phoneNumber, user.id, user.name);

      case 'greeting':
        return await this.handleGreeting(user.phoneNumber, user.id, user.name);

      case 'thanks':
        return await this.handleThanks(user.phoneNumber, user.id);

      default:
        return await this.handleUnclear(user.phoneNumber, user.id, message);
    }
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Main orchestrator - handles all reminder operations and general conversation';
  }

  /**
   * Detect user intent from message
   */
  private detectIntent(message: string): string {
    // Greetings
    if (/^(hi|hello|hey|hola|namaste|sup|yo)\b/i.test(message)) {
      return 'greeting';
    }

    // Thanks
    if (/\b(thank|thanks|thx|ty|appreciate)\b/i.test(message)) {
      return 'thanks';
    }

    // Help
    if (/\b(help|what can you do|how do|guide|support)\b/i.test(message)) {
      return 'help';
    }

    // List reminders
    if (/^(list|show|view|my|what)\s*(reminders?|all|pinned)/i.test(message)) {
      return 'list_reminders';
    }

    // Delete reminder
    if (/^(cancel|delete|remove|clear)\s*(reminder)?/i.test(message)) {
      return 'delete_reminder';
    }

    // Create reminder - if message contains time expression
    if (this.dateTimeAgent.hasTimeExpression(message)) {
      return 'create_reminder';
    }

    // Explicit reminder keywords
    if (/\b(remind|reminder|pin|remember)\b/i.test(message)) {
      return 'create_reminder';
    }

    return 'unclear';
  }

  /**
   * Handle creating a reminder
   */
  private async handleCreateReminder(
    phoneNumber: string,
    userId: string,
    _userName: string | null | undefined,
    message: string
  ): Promise<AgentResponse> {
    try {
      // Parse time expression using DateTimeAgent
      const parsedTime = this.dateTimeAgent.parseDateTime(message);

      if (!parsedTime || !parsedTime.scheduledTime) {
        await this.sendMessage(
          phoneNumber,
          userId,
          `hmm, I didn't catch when you want to be reminded. could you tell me the time? like "tomorrow at 7" or "in 2 hours"?`,
          { intent: 'time_unclear' }
        );
        return { message: '' };
      }

      // Extract task text by removing time/date expressions
      let task = message
        .replace(new RegExp(parsedTime.timeExpression, 'gi'), '')
        .replace(parsedTime.dateExpression ? new RegExp(parsedTime.dateExpression, 'gi') : '', '')
        .replace(/\b(remind me to|remind me|remind|to|at|on|-|pin)\b/gi, ' ')
        .trim();

      if (!task || task.length === 0) {
        await this.sendMessage(
          phoneNumber,
          userId,
          `got the time, but what should I remind you about?`,
          { intent: 'task_unclear' }
        );
        return { message: '' };
      }

      // Create reminder using ReminderAgent (storage)
      const reminderData: ReminderData = {
        userId,
        task,
        dueDatetime: parsedTime.scheduledTime,
        timezone: 'Asia/Kolkata',
        originalInput: message,
      };

      const reminder = await this.reminderAgent.createReminder(reminderData);

      // Schedule the reminder in the queue to be sent at the scheduled time
      await this.reminderQueue.scheduleReminder(reminder, phoneNumber);
      logger.info({ reminderId: reminder.id, scheduledTime: reminder.scheduledTime }, 'Reminder scheduled in queue');

      // Format confirmation
      const timeStr = this.dateTimeAgent.formatDateTime(parsedTime.scheduledTime);
      const confirmMsg = `done. I'll remind you to ${task} ${timeStr.toLowerCase()}.`;

      await this.sendMessage(phoneNumber, userId, confirmMsg, {
        intent: 'reminder_created',
        relatedId: reminder.id,
      });

      return { message: '' };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to create reminder');

      await this.sendMessage(
        phoneNumber,
        userId,
        `oops, something broke. mind trying that again?`,
        { intent: 'error' }
      );

      return { message: '' };
    }
  }

  /**
   * Handle listing reminders
   */
  private async handleListReminders(
    phoneNumber: string,
    userId: string,
    _userName: string | null | undefined
  ): Promise<AgentResponse> {
    try {
      const reminders = await this.reminderAgent.getUpcomingReminders(userId);

      if (reminders.length === 0) {
        await this.sendMessage(
          phoneNumber,
          userId,
          `you don't have any reminders pinned yet. want to set one?`,
          { intent: 'no_reminders' }
        );
        return { message: '' };
      }

      // Format reminders list
      const remindersList = reminders
        .map((reminder, index) => {
          const timeStr = this.dateTimeAgent.formatDateTime(reminder.scheduledTime);
          return `${index + 1}. ${timeStr.toLowerCase()} - ${reminder.reminderText}`;
        })
        .join('\n');

      const listMsg = `here's what you've pinned:\n\n${remindersList}\n\nto cancel any, just say "delete reminder 1" (or whatever number).`;

      await this.sendMessage(phoneNumber, userId, listMsg, {
        intent: 'list_reminders',
      });

      return { message: '' };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to list reminders');

      await this.sendMessage(
        phoneNumber,
        userId,
        `couldn't fetch your reminders right now. try again?`,
        { intent: 'error' }
      );

      return { message: '' };
    }
  }

  /**
   * Handle deleting a reminder
   */
  private async handleDeleteReminder(
    phoneNumber: string,
    userId: string,
    _userName: string | null | undefined,
    message: string
  ): Promise<AgentResponse> {
    try {
      // Extract reminder number from message
      const numbers = this.extractNumbers(message);

      if (numbers.length === 0) {
        // No number specified - show list
        const reminders = await this.reminderAgent.getUpcomingReminders(userId);

        if (reminders.length === 0) {
          await this.sendMessage(
            phoneNumber,
            userId,
            `you don't have any reminders to cancel.`,
            { intent: 'no_reminders' }
          );
          return { message: '' };
        }

        const remindersList = reminders
          .map((reminder, index) => {
            const timeStr = this.dateTimeAgent.formatDateTime(reminder.scheduledTime);
            return `${index + 1}. ${timeStr.toLowerCase()} - ${reminder.reminderText}`;
          })
          .join('\n');

        const askMsg = `which one should I cancel?\n\n${remindersList}\n\njust reply with the number, like "1" or "delete 2".`;

        await this.sendMessage(phoneNumber, userId, askMsg, {
          intent: 'ask_which_reminder',
        });

        return { message: '' };
      }

      // Get the reminder by index
      const index = numbers[0] - 1;
      const reminders = await this.reminderAgent.getUpcomingReminders(userId);

      if (index < 0 || index >= reminders.length) {
        await this.sendMessage(
          phoneNumber,
          userId,
          `you don't have a reminder #${numbers[0]}. you've got ${reminders.length} reminder(s) total.`,
          { intent: 'invalid_number' }
        );
        return { message: '' };
      }

      // Delete the reminder
      const reminder = reminders[index];
      await this.reminderAgent.deleteReminder(reminder.id);

      // Remove from queue if it was scheduled
      await this.reminderQueue.cancelReminder(reminder.id);
      logger.info({ reminderId: reminder.id }, 'Reminder cancelled and removed from queue');

      const cancelMsg = `done. cancelled: "${reminder.reminderText}"`;

      await this.sendMessage(phoneNumber, userId, cancelMsg, {
        intent: 'reminder_cancelled',
        relatedId: reminder.id,
      });

      return { message: '' };
    } catch (error) {
      logger.error({ userId, error}, 'Failed to delete reminder');

      await this.sendMessage(
        phoneNumber,
        userId,
        `couldn't cancel that reminder. try again?`,
        { intent: 'error' }
      );

      return { message: '' };
    }
  }

  /**
   * Handle help request
   */
  private async handleHelp(
    phoneNumber: string,
    userId: string,
    _userName: string | null | undefined
  ): Promise<AgentResponse> {
    const helpMsg = `here's what I can do:\n\n📌 *create reminders*\njust tell me like you'd text a friend:\n• "remind me at 7pm to call mom"\n• "tomorrow 10am - doctor appointment"\n• "pay rent on 15th"\n\n📋 *see what's pinned*\nsay "show my reminders" or "what all I have"\n\n❌ *cancel reminders*\nsay "cancel reminder 1" or "delete all"\n\njust chat naturally - I'll figure it out.`;

    await this.sendMessage(phoneNumber, userId, helpMsg, {
      intent: 'help',
    });

    return { message: '' };
  }

  /**
   * Handle greeting
   */
  private async handleGreeting(
    phoneNumber: string,
    userId: string,
    userName: string | null | undefined
  ): Promise<AgentResponse> {
    const name = userName || 'there';
    const responses = [
      `hey ${name}! what can I pin for you?`,
      `hi ${name}! need a reminder?`,
      `yo ${name}! what shouldn't you forget today?`,
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    await this.sendMessage(phoneNumber, userId, response, {
      intent: 'greeting',
    });

    return { message: '' };
  }

  /**
   * Handle thanks
   */
  private async handleThanks(phoneNumber: string, userId: string): Promise<AgentResponse> {
    const responses = [
      `anytime! that's what I'm here for.`,
      `you're welcome! need anything else pinned?`,
      `no worries! I gotchu.`,
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    await this.sendMessage(phoneNumber, userId, response, {
      intent: 'thanks',
    });

    return { message: '' };
  }

  /**
   * Handle unclear intent
   */
  private async handleUnclear(
    phoneNumber: string,
    userId: string,
    _message: string
  ): Promise<AgentResponse> {
    const responses = [
      `hmm, not sure what you mean. want to set a reminder? just tell me when and what, like "tomorrow at 3pm - call Rohan"`,
      `didn't quite catch that. to set a reminder, just say something like "remind me at 7 to pay bills"`,
      `not sure what you're asking. try:\n• "remind me tomorrow morning"\n• "list my reminders"\n• "help"`,
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    await this.sendMessage(phoneNumber, userId, response, {
      intent: 'unclear',
    });

    return { message: '' };
  }
}

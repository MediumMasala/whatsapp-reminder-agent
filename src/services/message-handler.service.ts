import { User } from '@prisma/client';
import { ReminderParser } from '../utils/reminder-parser';
import { ReminderService } from './reminder.service';
import { ConversationService } from './conversation.service';
import { WhatsAppService } from './whatsapp.service';
import { logger } from '../config/logger';
import { DetectedIntent } from '../types';

/**
 * Core message handling and conversational flow logic
 */
export class MessageHandler {
  private parser: ReminderParser;
  private reminderService: ReminderService;
  private conversationService: ConversationService;
  private whatsappService: WhatsAppService;

  constructor() {
    this.parser = new ReminderParser();
    this.reminderService = new ReminderService();
    this.conversationService = new ConversationService();
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Handle user message and orchestrate response
   */
  async handleUserMessage(user: User, messageText: string): Promise<void> {
    logger.info({ userId: user.id, messageText }, 'Handling user message');

    // Get conversation context for context-aware responses
    const context = await this.conversationService.getContext(user.id, 5);

    // Detect intent
    const intent = this.detectIntent(messageText, context.lastIntent);

    // Route to appropriate handler
    switch (intent) {
      case 'create_reminder':
        await this.handleCreateReminder(user, messageText);
        break;

      case 'list_reminders':
        await this.handleListReminders(user);
        break;

      case 'cancel_reminder':
        await this.handleCancelReminder(user, messageText);
        break;

      case 'help':
        await this.handleHelp(user);
        break;

      default:
        await this.handleUnknown(user, messageText);
        break;
    }
  }

  private detectIntent(message: string, _lastIntent?: DetectedIntent): DetectedIntent {
    const lowerMessage = message.toLowerCase();

    // List reminders
    if (/\b(list|show|my reminders|upcoming|what|all)\b/i.test(lowerMessage)) {
      return 'list_reminders';
    }

    // Cancel reminder
    if (/\b(cancel|delete|remove|stop)\b/i.test(lowerMessage)) {
      return 'cancel_reminder';
    }

    // Help
    if (/\b(help|how|what can)\b/i.test(lowerMessage)) {
      return 'help';
    }

    // Create reminder
    if (this.parser.isReminderRequest(message)) {
      return 'create_reminder';
    }

    return 'unknown';
  }

  private async handleCreateReminder(user: User, messageText: string): Promise<void> {
    try {
      // Parse reminder
      const parsed = this.parser.parse(messageText);

      if (!parsed) {
        await this.sendMessage(user.phoneNumber, {
          userId: user.id,
          text: "I couldn't understand the time. Please try again with a format like:\n\n• Tomorrow at 9am\n• 7pm today\n• Tomorrow evening",
          intent: 'create_reminder',
        });
        return;
      }

      // Create reminder
      const reminder = await this.reminderService.createReminder({
        userId: user.id,
        reminderText: parsed.text,
        scheduledTime: parsed.scheduledTime,
        metadata: parsed.extractedData,
      });

      // Store interaction in conversation
      await this.conversationService.storeMessage({
        userId: user.id,
        direction: 'inbound',
        messageText,
        detectedIntent: 'create_reminder',
        extractedData: parsed.extractedData,
        relatedReminderId: reminder.id,
      });

      // Format confirmation message
      const timeStr = this.formatDateTime(parsed.scheduledTime);
      const confirmationMsg = `✓ Reminder set!\n\n📝 ${parsed.text}\n⏰ ${timeStr}`;

      await this.sendMessage(user.phoneNumber, {
        userId: user.id,
        text: confirmationMsg,
        intent: 'create_reminder',
        relatedReminderId: reminder.id,
      });

      logger.info({ reminderId: reminder.id, userId: user.id }, 'Reminder created successfully');
    } catch (error) {
      logger.error({ error, userId: user.id }, 'Error creating reminder');
      await this.sendMessage(user.phoneNumber, {
        userId: user.id,
        text: 'Sorry, there was an error creating your reminder. Please try again.',
        intent: 'create_reminder',
      });
    }
  }

  private async handleListReminders(user: User): Promise<void> {
    const upcomingReminders = await this.reminderService.getUpcomingReminders(user.id);

    if (upcomingReminders.length === 0) {
      await this.sendMessage(user.phoneNumber, {
        userId: user.id,
        text: 'You have no upcoming reminders.\n\nCreate one by sending a message like "Remind me tomorrow at 9am to call doctor"',
        intent: 'list_reminders',
      });
      return;
    }

    // Format reminders list
    const remindersList = upcomingReminders
      .slice(0, 10)
      .map((r, idx) => {
        const timeStr = this.formatDateTime(r.scheduledTime);
        return `${idx + 1}. ${r.reminderText}\n   ⏰ ${timeStr}`;
      })
      .join('\n\n');

    const message = `Your upcoming reminders:\n\n${remindersList}`;

    await this.sendMessage(user.phoneNumber, {
      userId: user.id,
      text: message,
      intent: 'list_reminders',
    });
  }

  private async handleCancelReminder(user: User, _messageText: string): Promise<void> {
    await this.sendMessage(user.phoneNumber, {
      userId: user.id,
      text: 'To cancel a reminder, please send "list" to see all reminders, then reply with the number to cancel.',
      intent: 'cancel_reminder',
    });
  }

  private async handleHelp(user: User): Promise<void> {
    const helpText = `I'm your reminder assistant! Here's what I can do:\n\n📝 Create reminders:\n"Remind me tomorrow at 9am to call doctor"\n"Pay rent at 7pm"\n\n📋 List reminders:\n"Show my reminders"\n"List all"\n\n❌ Cancel reminders:\n"Cancel reminder"\n\nJust talk naturally and I'll help you remember important things!`;

    await this.sendMessage(user.phoneNumber, {
      userId: user.id,
      text: helpText,
      intent: 'help',
    });
  }

  private async handleUnknown(user: User, messageText: string): Promise<void> {
    // Get context to check if we're in an active flow
    const context = await this.conversationService.getActiveReminderContext(user.id);

    if (context.hasActiveReminderFlow) {
      // User might be continuing a reminder flow
      await this.handleCreateReminder(user, messageText);
    } else {
      await this.sendMessage(user.phoneNumber, {
        userId: user.id,
        text: "I'm not sure what you mean. Try:\n\n• Setting a reminder: \"Tomorrow at 9am call doctor\"\n• Viewing reminders: \"List my reminders\"\n• Getting help: \"Help\"",
        intent: 'unknown',
      });
    }
  }

  private async sendMessage(
    phoneNumber: string,
    data: {
      userId: string;
      text: string;
      intent?: DetectedIntent;
      relatedReminderId?: string;
    }
  ): Promise<void> {
    const result = await this.whatsappService.sendTextMessage({
      to: phoneNumber,
      message: data.text,
    });

    // Store outbound message in conversation history
    await this.conversationService.storeMessage({
      userId: data.userId,
      direction: 'outbound',
      messageText: data.text,
      whatsappMessageId: result.messageId,
      detectedIntent: data.intent,
      relatedReminderId: data.relatedReminderId,
    });
  }

  private formatDateTime(date: Date): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      return `${dateStr} at ${timeStr}`;
    }
  }

  /**
   * Handle WhatsApp message status updates
   */
  async handleStatusUpdate(messageId: string, status: string): Promise<void> {
    logger.debug({ messageId, status }, 'Handling status update');

    // Update reminder status if this is a reminder notification
    // This could be enhanced to track delivery/read status
    if (status === 'delivered' || status === 'read') {
      // Find reminder by whatsapp message ID and update status
      // Implementation can be added based on requirements
    }
  }
}

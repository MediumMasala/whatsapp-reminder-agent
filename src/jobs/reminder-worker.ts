import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { ReminderJobData } from './reminder-queue';
import { ReminderService } from '../services/reminder.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { ConversationService } from '../services/conversation.service';
import { logger } from '../config/logger';

export class ReminderWorker {
  private worker: Worker<ReminderJobData>;
  private reminderService: ReminderService;
  private whatsappService: WhatsAppService;
  private conversationService: ConversationService;

  constructor() {
    this.reminderService = new ReminderService();
    this.whatsappService = new WhatsAppService();
    this.conversationService = new ConversationService();

    this.worker = new Worker<ReminderJobData>(
      'reminders',
      async (job: Job<ReminderJobData>) => this.processReminder(job),
      {
        connection: getRedisClient(),
        concurrency: 5,
        limiter: {
          max: 10, // Max 10 messages
          duration: 1000, // per second (rate limiting)
        },
      }
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'Reminder job completed');
    });

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err }, 'Reminder job failed');
    });

    this.worker.on('error', (err) => {
      logger.error({ error: err }, 'Worker error');
    });

    logger.info('Reminder worker started');
  }

  /**
   * Process a reminder job
   */
  private async processReminder(job: Job<ReminderJobData>): Promise<void> {
    const { reminderId, userId, phoneNumber, reminderText } = job.data;

    logger.info({ reminderId, userId }, 'Processing reminder');

    try {
      // Check if reminder still exists and is pending
      const reminder = await this.reminderService.getReminderById(reminderId);

      if (!reminder) {
        logger.warn({ reminderId }, 'Reminder not found, skipping');
        return;
      }

      if (reminder.status !== 'pending') {
        logger.warn(
          { reminderId, status: reminder.status },
          'Reminder is not pending, skipping'
        );
        return;
      }

      // Send WhatsApp message
      const message = `🔔 Reminder:\n\n${reminderText}`;

      const result = await this.whatsappService.sendTextMessage({
        to: phoneNumber,
        message,
      });

      // Update reminder status
      await this.reminderService.markAsSent(reminderId, result.messageId);

      // Store outbound message in conversation history
      await this.conversationService.storeMessage({
        userId,
        direction: 'outbound',
        messageText: message,
        whatsappMessageId: result.messageId,
        detectedIntent: 'create_reminder',
        relatedReminderId: reminderId,
      });

      logger.info(
        { reminderId, messageId: result.messageId },
        'Reminder sent successfully'
      );
    } catch (error) {
      logger.error({ error, reminderId }, 'Failed to send reminder');

      // Mark reminder as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.reminderService.markAsFailed(reminderId, errorMessage);

      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Close worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    logger.info('Reminder worker closed');
  }
}

import { ReminderQueue } from './reminder-queue';
import { ReminderService } from '../services/reminder.service';
import { UserService } from '../services/user.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Scheduler that periodically checks for reminders that need to be queued
 * This ensures reminders created while the system was down get scheduled
 */
export class ReminderScheduler {
  private queue: ReminderQueue;
  private reminderService: ReminderService;
  private userService: UserService;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.queue = new ReminderQueue();
    this.reminderService = new ReminderService();
    this.userService = new UserService();
  }

  /**
   * Start the scheduler
   */
  start(): void {
    logger.info('Starting reminder scheduler');

    // Run immediately on start
    this.checkAndScheduleReminders();

    // Then run periodically
    this.intervalId = setInterval(
      () => this.checkAndScheduleReminders(),
      env.REMINDER_CHECK_INTERVAL_MS
    );
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      logger.info('Reminder scheduler stopped');
    }
  }

  /**
   * Check for pending reminders and schedule them
   */
  private async checkAndScheduleReminders(): Promise<void> {
    try {
      // Get all pending reminders that should be sent in the next hour
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      const pendingReminders = await this.reminderService.getPendingReminders(
        oneHourFromNow
      );

      if (pendingReminders.length === 0) {
        logger.debug('No pending reminders to schedule');
        return;
      }

      logger.info(
        { count: pendingReminders.length },
        'Found pending reminders to schedule'
      );

      // Schedule each reminder
      for (const reminder of pendingReminders) {
        try {
          // Get user's phone number
          const user = await this.userService.getUserById(reminder.userId);

          if (!user) {
            logger.warn({ reminderId: reminder.id }, 'User not found for reminder');
            continue;
          }

          // Schedule in queue
          await this.queue.scheduleReminder(reminder, user.phoneNumber);
        } catch (error) {
          logger.error(
            { error, reminderId: reminder.id },
            'Failed to schedule reminder'
          );
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error in reminder scheduler');
    }
  }

  /**
   * Close scheduler and queue
   */
  async close(): Promise<void> {
    this.stop();
    await this.queue.close();
  }
}

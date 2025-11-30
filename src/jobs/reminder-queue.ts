import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import { Reminder } from '@prisma/client';

export interface ReminderJobData {
  reminderId: string;
  userId: string;
  phoneNumber: string;
  reminderText: string;
}

export class ReminderQueue {
  private queue: Queue<ReminderJobData>;
  private connection;

  constructor() {
    this.connection = getRedisClient();

    this.queue = new Queue<ReminderJobData>('reminders', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    logger.info('Reminder queue initialized');
  }

  /**
   * Schedule a reminder for a specific time
   */
  async scheduleReminder(reminder: Reminder, phoneNumber: string): Promise<void> {
    const delay = reminder.scheduledTime.getTime() - Date.now();

    if (delay < 0) {
      logger.warn(
        { reminderId: reminder.id },
        'Reminder scheduled time is in the past, scheduling immediately'
      );
    }

    const jobData: ReminderJobData = {
      reminderId: reminder.id,
      userId: reminder.userId,
      phoneNumber,
      reminderText: reminder.reminderText,
    };

    await this.queue.add(
      'send-reminder',
      jobData,
      {
        delay: Math.max(0, delay),
        jobId: reminder.id, // Use reminder ID to prevent duplicates
      }
    );

    logger.info(
      {
        reminderId: reminder.id,
        scheduledTime: reminder.scheduledTime,
        delay,
      },
      'Reminder scheduled in queue'
    );
  }

  /**
   * Cancel a scheduled reminder
   */
  async cancelReminder(reminderId: string): Promise<void> {
    const job = await this.queue.getJob(reminderId);

    if (job) {
      await job.remove();
      logger.info({ reminderId }, 'Reminder removed from queue');
    }
  }

  /**
   * Get queue instance for worker
   */
  getQueue(): Queue<ReminderJobData> {
    return this.queue;
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    await this.queue.close();
    logger.info('Reminder queue closed');
  }
}

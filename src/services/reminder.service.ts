import { ReminderRepository } from '../repositories/reminder.repository';
import { CreateReminderInput, ReminderStatus } from '../types';
import { Reminder } from '@prisma/client';
import { logger } from '../config/logger';

export class ReminderService {
  private repository: ReminderRepository;

  constructor(repository?: ReminderRepository) {
    this.repository = repository || new ReminderRepository();
  }

  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    logger.info(
      {
        userId: input.userId,
        scheduledTime: input.scheduledTime,
      },
      'Creating reminder'
    );

    return this.repository.create(input);
  }

  async getUserReminders(userId: string, status?: ReminderStatus): Promise<Reminder[]> {
    return this.repository.findByUserId(userId, status);
  }

  async getUpcomingReminders(userId: string): Promise<Reminder[]> {
    const reminders = await this.repository.findByUserId(userId, 'pending');
    return reminders.filter(r => r.scheduledTime > new Date());
  }

  async getPendingReminders(beforeTime?: Date): Promise<Reminder[]> {
    return this.repository.findPendingReminders(beforeTime);
  }

  async cancelReminder(id: string): Promise<Reminder> {
    logger.info({ reminderId: id }, 'Cancelling reminder');
    return this.repository.cancel(id);
  }

  async markAsSent(id: string, whatsappMsgId: string): Promise<Reminder> {
    logger.info({ reminderId: id, whatsappMsgId }, 'Marking reminder as sent');
    return this.repository.markAsSent(id, whatsappMsgId);
  }

  async markAsDelivered(id: string): Promise<Reminder> {
    return this.repository.markAsDelivered(id);
  }

  async markAsFailed(id: string, reason: string): Promise<Reminder> {
    logger.error({ reminderId: id, reason }, 'Marking reminder as failed');
    return this.repository.markAsFailed(id, reason);
  }

  async getReminderById(id: string): Promise<Reminder | null> {
    return this.repository.findById(id);
  }
}

import { ReminderService } from '../services/reminder.service';
import { logger } from '../config/logger';

/**
 * Reminder Data Structure
 */
export interface ReminderData {
  userId: string;
  task: string;
  dueDatetime: Date;
  timezone: string;
  originalInput: string;
  recurrence?: string | null;
}

/**
 * Reminder Agent - Storage Only (CRUD Operations)
 *
 * This agent is purely for storage and retrieval of reminders.
 * It does NOT interact with users directly.
 * It only returns structured data.
 *
 * The Conversation Agent orchestrates this agent to store/retrieve reminders.
 */
export class ReminderAgent {
  private reminderService: ReminderService;

  constructor() {
    this.reminderService = new ReminderService();
  }

  /**
   * Create a new reminder
   */
  async createReminder(data: ReminderData) {
    logger.info({ userId: data.userId, task: data.task }, 'Creating reminder');

    const reminder = await this.reminderService.createReminder({
      userId: data.userId,
      reminderText: data.task,
      scheduledTime: data.dueDatetime,
      metadata: {
        originalMessage: data.originalInput,
        timezone: data.timezone,
        recurrence: data.recurrence,
      },
    });

    logger.info({ reminderId: reminder.id }, 'Reminder created successfully');
    return reminder;
  }

  /**
   * Get a reminder by ID
   */
  async getReminderById(reminderId: string) {
    return await this.reminderService.getReminderById(reminderId);
  }

  /**
   * Find reminders for a user
   * @param userId - User ID
   * @param filters - Optional filters (status, date range, etc.)
   */
  async findReminders(userId: string, filters?: {
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    searchText?: string;
  }) {
    logger.info({ userId, filters }, 'Finding reminders');
    return await this.reminderService.getUpcomingReminders(userId);
  }

  /**
   * Update a reminder
   */
  async updateReminder(reminderId: string, updates: Partial<ReminderData>) {
    logger.info({ reminderId, updates }, 'Updating reminder');

    const updateData: any = {};

    if (updates.task) {
      updateData.reminderText = updates.task;
    }

    if (updates.dueDatetime) {
      updateData.scheduledTime = updates.dueDatetime;
    }

    if (updates.recurrence !== undefined) {
      updateData.metadata = { recurrence: updates.recurrence };
    }

    // Note: ReminderService might need an updateReminder method
    // For now, we'll return null if not implemented
    logger.warn('Update reminder not fully implemented in ReminderService');
    return null;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(reminderId: string) {
    logger.info({ reminderId }, 'Deleting reminder');
    await this.reminderService.cancelReminder(reminderId);
    return { success: true };
  }

  /**
   * Get due reminders (for scheduler)
   * @param now - Current timestamp
   */
  async getDueReminders(now: Date) {
    logger.info({ now }, 'Getting due reminders');
    // This would need to be implemented in ReminderService
    // For now, returning empty array
    return [];
  }

  /**
   * Get upcoming reminders for a user
   */
  async getUpcomingReminders(userId: string) {
    logger.info({ userId }, 'Getting upcoming reminders');
    return await this.reminderService.getUpcomingReminders(userId);
  }
}

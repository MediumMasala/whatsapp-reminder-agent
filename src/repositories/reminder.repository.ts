import { getPrismaClient } from '../config/database';
import { CreateReminderInput, UpdateReminderInput, ReminderStatus } from '../types';
import { Reminder } from '@prisma/client';

export class ReminderRepository {
  private prisma = getPrismaClient();

  async create(input: CreateReminderInput): Promise<Reminder> {
    return this.prisma.reminder.create({
      data: {
        userId: input.userId,
        reminderText: input.reminderText,
        scheduledTime: input.scheduledTime,
        metadata: input.metadata as any,
      },
    });
  }

  async findById(id: string): Promise<Reminder | null> {
    return this.prisma.reminder.findUnique({
      where: { id },
    });
  }

  async findByUserId(userId: string, status?: ReminderStatus): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  async findPendingReminders(beforeTime?: Date): Promise<Reminder[]> {
    return this.prisma.reminder.findMany({
      where: {
        status: 'pending',
        ...(beforeTime && { scheduledTime: { lte: beforeTime } }),
      },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  async update(id: string, data: UpdateReminderInput): Promise<Reminder> {
    return this.prisma.reminder.update({
      where: { id },
      data,
    });
  }

  async cancel(id: string): Promise<Reminder> {
    return this.update(id, { status: 'cancelled' });
  }

  async markAsSent(id: string, whatsappMsgId: string): Promise<Reminder> {
    return this.update(id, {
      status: 'sent',
      sentAt: new Date(),
      whatsappMsgId,
    });
  }

  async markAsDelivered(id: string): Promise<Reminder> {
    return this.update(id, {
      status: 'delivered',
      deliveredAt: new Date(),
    });
  }

  async markAsFailed(id: string, reason: string): Promise<Reminder> {
    return this.update(id, {
      status: 'failed',
      failureReason: reason,
    });
  }
}

import { Request, Response } from 'express';
import { getPrismaClient } from '../config/database';
import { logger } from '../config/logger';
import fs from 'fs';
import path from 'path';

export class AdminController {
  private prisma = getPrismaClient();
  private configPath = path.join(__dirname, '../config/bot-config.json');

  /**
   * Delete all data for a user by phone number
   * URL: /admin/delete/:phoneNumber
   */
  async deleteUserData(req: Request, res: Response): Promise<void> {
    try {
      const phoneNumber = req.params.phoneNumber;

      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      logger.info({ phoneNumber }, 'Admin: Deleting user data');

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          phoneNumber
        });
        return;
      }

      // Delete all related data in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Delete conversations
        const conversationsDeleted = await tx.conversation.deleteMany({
          where: { userId: user.id },
        });

        // Delete reminders
        const remindersDeleted = await tx.reminder.deleteMany({
          where: { userId: user.id },
        });

        // Delete user
        await tx.user.delete({
          where: { id: user.id },
        });

        return {
          conversationsDeleted: conversationsDeleted.count,
          remindersDeleted: remindersDeleted.count,
        };
      });

      logger.info(
        { phoneNumber, ...result },
        'Admin: User data deleted successfully'
      );

      res.json({
        success: true,
        message: 'User data deleted successfully',
        phoneNumber,
        deleted: {
          conversations: result.conversationsDeleted,
          reminders: result.remindersDeleted,
          user: 1,
        },
      });
    } catch (error) {
      logger.error({ error, phoneNumber: req.params.phoneNumber }, 'Admin: Error deleting user data');
      res.status(500).json({
        error: 'Failed to delete user data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get stats about a user
   * URL: /admin/stats/:phoneNumber
   */
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const phoneNumber = req.params.phoneNumber;

      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number is required' });
        return;
      }

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { phoneNumber },
      });

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          phoneNumber
        });
        return;
      }

      // Get counts
      const conversationCount = await this.prisma.conversation.count({
        where: { userId: user.id },
      });

      const reminderCount = await this.prisma.reminder.count({
        where: { userId: user.id },
      });

      const pendingReminders = await this.prisma.reminder.count({
        where: {
          userId: user.id,
          status: 'pending'
        },
      });

      res.json({
        phoneNumber,
        userId: user.id,
        stats: {
          totalConversations: conversationCount,
          totalReminders: reminderCount,
          pendingReminders,
        },
      });
    } catch (error) {
      logger.error({ error, phoneNumber: req.params.phoneNumber }, 'Admin: Error getting user stats');
      res.status(500).json({
        error: 'Failed to get user stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get bot configuration
   * URL: /admin/config
   */
  async getConfig(_req: Request, res: Response): Promise<void> {
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      res.json(config);
    } catch (error) {
      logger.error({ error }, 'Admin: Error reading config');
      res.status(500).json({ error: 'Failed to read configuration' });
    }
  }

  /**
   * Update bot configuration
   * URL: /admin/config (POST)
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      logger.info('Admin: Bot configuration updated');
      res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
      logger.error({ error }, 'Admin: Error updating config');
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  /**
   * Get dashboard statistics
   * URL: /admin/dashboard-stats
   */
  async getDashboardStats(_req: Request, res: Response): Promise<void> {
    try {
      const [totalUsers, totalReminders, pendingReminders, totalConversations] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.reminder.count(),
        this.prisma.reminder.count({ where: { status: 'pending' } }),
        this.prisma.conversation.count(),
      ]);

      res.json({
        totalUsers,
        totalReminders,
        pendingReminders,
        totalConversations,
      });
    } catch (error) {
      logger.error({ error }, 'Admin: Error getting dashboard stats');
      res.status(500).json({ error: 'Failed to get dashboard statistics' });
    }
  }
}

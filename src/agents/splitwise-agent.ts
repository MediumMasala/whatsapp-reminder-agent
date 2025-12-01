import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { BaseAgent } from './base-agent';
import { getPrismaClient } from '../config/database';
import { logger } from '../config/logger';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Splitwise Agent
 *
 * Handles expense tracking and bill splitting:
 * - Parse expense amounts from messages
 * - Multi-turn flow for collecting participants
 * - Calculate equal splits
 * - Store and list expenses
 */
export class SplitwiseAgent extends BaseAgent implements IAgent {
  readonly type: AgentType = 'splitwise';
  readonly name: string = 'Splitwise Agent';
  private prisma = getPrismaClient();

  /**
   * Check if this agent should handle the message
   */
  async canHandle(context: AgentContext): Promise<boolean> {
    const message = context.message.toLowerCase().trim();

    // Explicit expense commands
    if (/^(split|expense|spent|paid|bill)/i.test(message)) {
      return true;
    }

    // Currency patterns
    if (
      /(₹|rs\.?|rupees?)\s*\d+|\\d+\s*(₹|rs\.?|rupees?)/i.test(message) ||
      (/\d{2,}/.test(message) && /(spent|paid|cost|bill|dinner|lunch|food)/i.test(message))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Handle expense operations
   */
  async handle(context: AgentContext): Promise<AgentResponse> {
    const { user, message, currentFlow, flowData } = context;

    logger.info({ userId: user.id, flow: currentFlow }, 'Splitwise agent processing');

    // List expenses
    if (/^(list|show|view|my)\s*(expenses?|bills?)/i.test(message.toLowerCase())) {
      return await this.listExpenses(user.phoneNumber, user.id);
    }

    // Active flow - collecting participant data
    if (currentFlow === 'split_expense') {
      return await this.handleExpenseFlow(user.phoneNumber, user.id, message, flowData);
    }

    // New expense - start flow
    return await this.startExpenseFlow(user.phoneNumber, user.id, message);
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Tracks expenses and splits bills among friends with smart calculations';
  }

  /**
   * Start new expense flow
   */
  private async startExpenseFlow(
    phoneNumber: string,
    userId: string,
    message: string
  ): Promise<AgentResponse> {
    // Extract amount
    const amount = this.extractAmount(message);

    if (!amount) {
      await this.sendMessage(
        phoneNumber,
        userId,
        "I couldn't find an amount in your message. How much was spent? (e.g., '₹1200' or 'Rs. 500')",
        { intent: 'expense_amount_unclear' }
      );
      return {
        message: '',
        metadata: { error: 'amount_unclear' },
      };
    }

    // Extract description (remove amount patterns)
    let description = message
      .replace(/₹\s*\d+/g, '')
      .replace(/rs\.?\s*\d+/gi, '')
      .replace(/\d+\s*(₹|rs\.?|rupees?)/gi, '')
      .replace(/^(split|expense|spent|paid|bill)\s*/i, '')
      .trim();

    if (!description) {
      description = 'Expense';
    }

    // Start flow
    await this.startFlow(userId, 'split_expense', {
      amount,
      description,
      originalMessage: message,
    });

    const askMsg = `Got it! ₹${amount} for "${description}".\n\nHow many people are splitting this? (including you)`;

    await this.sendMessage(phoneNumber, userId, askMsg, {
      intent: 'expense_ask_count',
    });

    return {
      message: '',
      flowComplete: false,
    };
  }

  /**
   * Handle expense flow steps
   */
  private async handleExpenseFlow(
    phoneNumber: string,
    userId: string,
    message: string,
    flowData?: Record<string, any>
  ): Promise<AgentResponse> {
    if (!flowData) {
      return { message: 'Flow data missing' };
    }

    const { amount, description, participantCount, participantNames } = flowData;

    // Step 1: Collect participant count
    if (!participantCount) {
      const count = parseInt(message.trim(), 10);

      if (isNaN(count) || count < 2) {
        await this.sendMessage(
          phoneNumber,
          userId,
          "Please enter a valid number of people (at least 2).",
          { intent: 'expense_count_invalid' }
        );
        return { message: '', flowComplete: false };
      }

      if (count > 20) {
        await this.sendMessage(
          phoneNumber,
          userId,
          "That's a lot of people! Let's keep it under 20 for now.",
          { intent: 'expense_count_too_high' }
        );
        return { message: '', flowComplete: false };
      }

      await this.updateFlowData(userId, { participantCount: count });

      const askNamesMsg = `Perfect! ${count} people splitting ₹${amount}.\n\nPlease send me the names, one per line:\n\nExample:\nYash\nRohit\nPriya`;

      await this.sendMessage(phoneNumber, userId, askNamesMsg, {
        intent: 'expense_ask_names',
      });

      return { message: '', flowComplete: false };
    }

    // Step 2: Collect participant names
    if (!participantNames) {
      const names = message
        .split('\n')
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (names.length !== participantCount) {
        await this.sendMessage(
          phoneNumber,
          userId,
          `I need exactly ${participantCount} names. You sent ${names.length}. Please send them again, one per line.`,
          { intent: 'expense_names_count_mismatch' }
        );
        return { message: '', flowComplete: false };
      }

      // Validate names
      for (const name of names) {
        if (name.length < 2 || name.length > 30) {
          await this.sendMessage(
            phoneNumber,
            userId,
            `"${name}" doesn't look like a valid name. Please send the names again.`,
            { intent: 'expense_names_invalid' }
          );
          return { message: '', flowComplete: false };
        }
      }

      await this.updateFlowData(userId, { participantNames: names });

      // Calculate and create expense
      return await this.createExpense(phoneNumber, userId, {
        amount,
        description,
        participantCount,
        participantNames: names,
      });
    }

    return { message: 'Unexpected flow state' };
  }

  /**
   * Create and save the expense
   */
  private async createExpense(
    phoneNumber: string,
    userId: string,
    data: {
      amount: number;
      description: string;
      participantCount: number;
      participantNames: string[];
    }
  ): Promise<AgentResponse> {
    const { amount, description, participantNames } = data;
    const perPersonShare = amount / participantNames.length;

    try {
      // Create expense with participants
      const expense = await this.prisma.expense.create({
        data: {
          userId,
          totalAmount: new Decimal(amount),
          description,
          participants: {
            create: participantNames.map((name) => ({
              name,
              share: new Decimal(perPersonShare.toFixed(2)),
            })),
          },
        },
        include: {
          participants: true,
        },
      });

      // Format confirmation
      const participantsList = participantNames
        .map((name) => `• ${name}: ₹${perPersonShare.toFixed(2)}`)
        .join('\n');

      const confirmMsg = `✅ Expense recorded!\n\n💰 Total: ₹${amount}\n📝 ${description}\n\nSplit among ${participantNames.length} people:\n${participantsList}\n\nEach person pays ₹${perPersonShare.toFixed(2)}`;

      await this.sendMessage(phoneNumber, userId, confirmMsg, {
        intent: 'expense_created',
        relatedId: expense.id,
      });

      // Complete flow
      await this.completeFlow(userId);

      logger.info({ userId, expenseId: expense.id, amount }, 'Expense created');

      return {
        message: '',
        flowComplete: true,
        metadata: {
          expenseId: expense.id,
          amount,
          perPersonShare,
        },
      };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to create expense');

      await this.sendMessage(
        phoneNumber,
        userId,
        "Oops! Something went wrong saving the expense. Please try again.",
        { intent: 'expense_error' }
      );

      await this.completeFlow(userId);

      return {
        message: '',
        flowComplete: true,
        metadata: { error: 'creation_failed' },
      };
    }
  }

  /**
   * List recent expenses
   */
  private async listExpenses(phoneNumber: string, userId: string): Promise<AgentResponse> {
    try {
      const expenses = await this.prisma.expense.findMany({
        where: { userId },
        include: { participants: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      if (expenses.length === 0) {
        await this.sendMessage(
          phoneNumber,
          userId,
          "You haven't recorded any expenses yet. Want to split a bill?",
          { intent: 'expense_list_empty' }
        );
        return { message: '' };
      }

      // Format expenses list
      const expensesList = expenses
        .map((expense, index) => {
          const date = expense.createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          const participantCount = expense.participants.length;
          const perPerson = Number(expense.totalAmount) / participantCount;

          return `${index + 1}. ${date} - ₹${expense.totalAmount}\n   ${expense.description || 'Expense'}\n   ${participantCount} people × ₹${perPerson.toFixed(2)} each`;
        })
        .join('\n\n');

      const listMsg = `💰 Your recent expenses:\n\n${expensesList}`;

      await this.sendMessage(phoneNumber, userId, listMsg, {
        intent: 'expense_list',
      });

      return { message: '' };
    } catch (error) {
      logger.error({ userId, error }, 'Failed to list expenses');

      await this.sendMessage(
        phoneNumber,
        userId,
        "Sorry, I couldn't fetch your expenses right now. Please try again.",
        { intent: 'expense_list_error' }
      );

      return {
        message: '',
        metadata: { error: 'list_failed' },
      };
    }
  }
}

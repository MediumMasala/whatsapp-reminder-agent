import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { BaseAgent } from './base-agent';
import { logger } from '../config/logger';

/**
 * Conversation Agent
 *
 * Handles general conversation and casual chat:
 * - Responds to greetings and casual messages
 * - Adds personality and humor
 * - Provides helpful guidance when user intent is unclear
 * - Acts as fallback when no other agent matches
 */
export class ConversationAgent extends BaseAgent implements IAgent {
  readonly type: AgentType = 'conversation';
  readonly name: string = 'Conversation Agent';

  /**
   * This agent has the lowest priority and handles everything else
   * It activates when no other agent can handle the message
   */
  async canHandle(_context: AgentContext): Promise<boolean> {
    // This is a fallback agent - it always returns true
    // But it should be checked last by the router
    return true;
  }

  /**
   * Handle general conversation
   */
  async handle(context: AgentContext): Promise<AgentResponse> {
    const { user, message } = context;
    const lowerMessage = message.toLowerCase().trim();

    logger.info({ userId: user.id, message }, 'Conversation agent handling message');

    // Greetings
    if (/^(hi|hello|hey|hola|namaste|sup|yo)\b/i.test(lowerMessage)) {
      return await this.handleGreeting(user.phoneNumber, user.id, user.name);
    }

    // Thanks
    if (/\b(thank|thanks|thx|ty|appreciate)\b/i.test(lowerMessage)) {
      return await this.handleThanks(user.phoneNumber, user.id);
    }

    // Help requests
    if (/\b(help|what can you do|how do|guide|support)\b/i.test(lowerMessage)) {
      return await this.handleHelp(user.phoneNumber, user.id);
    }

    // Status check
    if (/\b(how are you|wassup|what'?s up|how'?s it going)\b/i.test(lowerMessage)) {
      return await this.handleStatus(user.phoneNumber, user.id);
    }

    // Unclear intent
    return await this.handleUnclear(user.phoneNumber, user.id, message);
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Handles general conversation, greetings, and provides guidance when intent is unclear';
  }

  /**
   * Handle greeting messages
   */
  private async handleGreeting(
    phoneNumber: string,
    userId: string,
    userName?: string | null
  ): Promise<AgentResponse> {
    const greetings = [
      `Hey ${userName || 'there'}! 👋 What can I help you with today?`,
      `Hi ${userName || 'there'}! Ready to set some reminders or split some bills?`,
      `Hello ${userName || 'there'}! 😊 How can I assist you?`,
      `Hey ${userName || 'there'}! Need a reminder or want to track expenses?`,
    ];

    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    await this.sendMessage(phoneNumber, userId, greeting, {
      intent: 'greeting',
    });

    return { message: '' };
  }

  /**
   * Handle thank you messages
   */
  private async handleThanks(phoneNumber: string, userId: string): Promise<AgentResponse> {
    const responses = [
      "You're welcome! 😊",
      "Anytime! That's what I'm here for! 💪",
      "Happy to help! Need anything else?",
      "My pleasure! Let me know if you need more reminders!",
      "No problem at all! 👍",
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    await this.sendMessage(phoneNumber, userId, response, {
      intent: 'thanks_response',
    });

    return { message: '' };
  }

  /**
   * Handle help requests
   */
  private async handleHelp(phoneNumber: string, userId: string): Promise<AgentResponse> {
    const helpMsg = `Here's what I can do for you:\n\n📅 *Reminders*\n• "remind me at 7pm to pay rent"\n• "tomorrow at 10am - call doctor"\n• "list my reminders"\n\n💰 *Expense Splitting*\n• "I paid 500 for dinner with Raj"\n• "split 1200 between me, Sarah, and Alex"\n• "show my expenses"\n\nJust tell me what you need in plain English! 😊`;

    await this.sendMessage(phoneNumber, userId, helpMsg, {
      intent: 'help',
    });

    return { message: '' };
  }

  /**
   * Handle status check
   */
  private async handleStatus(phoneNumber: string, userId: string): Promise<AgentResponse> {
    const responses = [
      "I'm doing great! All systems running smoothly! 🚀 How can I help you?",
      "Living my best digital life! 😎 What do you need?",
      "I'm here and ready to help! What's up?",
      "All good on my end! Need a reminder or expense tracking?",
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    await this.sendMessage(phoneNumber, userId, response, {
      intent: 'status_check',
    });

    return { message: '' };
  }

  /**
   * Handle unclear intent - provide guidance
   */
  private async handleUnclear(
    phoneNumber: string,
    userId: string,
    message: string
  ): Promise<AgentResponse> {
    logger.info({ userId, message }, 'Unclear intent - providing guidance');

    // Add a touch of personality
    const responses = [
      "Hmm, I'm not quite sure what you mean. 🤔\n\nI can help you with:\n• Setting reminders (like 'remind me at 7pm to call mom')\n• Splitting expenses (like 'I paid 500 for dinner')\n• Listing your reminders or expenses\n\nWhat would you like to do?",
      "I didn't quite catch that! 😅\n\nTry:\n• 'remind me tomorrow at 10am to...'\n• 'split 1000 between me and John'\n• 'list my reminders'\n\nWhat can I help you with?",
      "Sorry, I'm a bit confused! 🙈\n\nI'm best at:\n• Creating reminders ('remind me at 3pm...')\n• Tracking expenses ('I paid 200 for...')\n• Showing your reminders/expenses\n\nCould you rephrase that?",
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    await this.sendMessage(phoneNumber, userId, response, {
      intent: 'unclear_intent',
    });

    return { message: '' };
  }
}

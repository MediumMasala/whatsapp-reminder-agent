import { ConversationRepository } from '../repositories/conversation.repository';
import {
  CreateConversationInput,
  ConversationContext,
  DetectedIntent,
} from '../types';
import { logger } from '../config/logger';
import { Conversation } from '@prisma/client';

export class ConversationService {
  private repository: ConversationRepository;

  constructor(repository?: ConversationRepository) {
    this.repository = repository || new ConversationRepository();
  }

  /**
   * Store a conversation message (inbound or outbound)
   * This is called for EVERY WhatsApp message
   */
  async storeMessage(input: CreateConversationInput): Promise<Conversation> {
    logger.info(
      {
        userId: input.userId,
        direction: input.direction,
        intent: input.detectedIntent,
      },
      'Storing conversation message'
    );

    return this.repository.create(input);
  }

  /**
   * Get conversation context for a user
   * Returns recent messages, last intent, active flow, etc.
   */
  async getContext(userId: string, limit: number = 10): Promise<ConversationContext> {
    const recentMessages = await this.repository.findRecentByUserId(userId, limit);

    // Extract the most recent intent and flow
    const lastIntent = recentMessages.find(m => m.detectedIntent)?.detectedIntent as DetectedIntent | undefined;
    const lastActiveFlow = recentMessages.find(m => m.activeFlow)?.activeFlow;
    const lastReminderId = recentMessages.find(m => m.relatedReminderId)?.relatedReminderId;

    return {
      recentMessages: recentMessages.reverse().map(msg => ({
        direction: msg.direction as 'inbound' | 'outbound',
        messageText: msg.messageText,
        timestamp: msg.timestamp,
        detectedIntent: msg.detectedIntent as DetectedIntent | undefined,
      })),
      lastIntent,
      lastActiveFlow,
      lastReminderId,
    };
  }

  /**
   * Get the last user message for context-aware responses
   */
  async getLastUserMessage(userId: string): Promise<Conversation | null> {
    return this.repository.findLastInboundMessage(userId);
  }

  /**
   * Find messages in a specific conversational flow
   * Useful for multi-step conversations
   */
  async getFlowMessages(userId: string, flow: string): Promise<Conversation[]> {
    return this.repository.findByActiveFlow(userId, flow);
  }

  /**
   * Get conversation stats
   */
  async getStats(userId: string): Promise<{ totalMessages: number }> {
    const totalMessages = await this.repository.countByUser(userId);
    return { totalMessages };
  }

  /**
   * Extract context from recent conversation
   * This enables smart responses like:
   * User: "Remind me to pay rent"
   * Bot: "When should I remind you?"
   * User: "Tomorrow at 9am" <- This needs context from previous message
   */
  async getActiveReminderContext(userId: string): Promise<{
    hasActiveReminderFlow: boolean;
    partialReminderText?: string;
    lastIntent?: DetectedIntent;
  }> {
    const context = await this.getContext(userId, 5);

    // Check if last intent was create_reminder
    const hasActiveReminderFlow = context.lastIntent === 'create_reminder';

    // Try to extract partial reminder text from recent messages
    let partialReminderText: string | undefined;
    if (hasActiveReminderFlow) {
      const lastUserMsg = context.recentMessages
        .filter(m => m.direction === 'inbound')
        .pop();
      partialReminderText = lastUserMsg?.messageText;
    }

    return {
      hasActiveReminderFlow,
      partialReminderText,
      lastIntent: context.lastIntent,
    };
  }
}

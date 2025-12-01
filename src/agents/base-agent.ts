import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { AgentStateService } from '../services/agent-state.service';
import { ConversationService } from '../services/conversation.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { logger } from '../config/logger';

/**
 * Base Agent
 *
 * Abstract class that all agents extend.
 * Provides common utilities for conversation, state management, and messaging.
 */
export abstract class BaseAgent implements IAgent {
  abstract readonly type: AgentType;
  abstract readonly name: string;

  protected agentStateService: AgentStateService;
  protected conversationService: ConversationService;
  protected whatsappService: WhatsAppService;

  constructor() {
    this.agentStateService = new AgentStateService();
    this.conversationService = new ConversationService();
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Each agent implements its own handling logic
   */
  abstract handle(context: AgentContext): Promise<AgentResponse>;

  /**
   * Each agent decides if it can handle a message
   */
  abstract canHandle(context: AgentContext): Promise<boolean>;

  /**
   * Get agent description
   */
  abstract getDescription(): string;

  /**
   * Helper: Send WhatsApp message and store in conversation
   */
  protected async sendMessage(
    phoneNumber: string,
    userId: string,
    message: string,
    metadata?: {
      intent?: string;
      relatedId?: string;
    }
  ): Promise<void> {
    logger.info({ userId, agent: this.type, messageLength: message.length }, 'Sending message');

    // Send via WhatsApp
    const result = await this.whatsappService.sendTextMessage({
      to: phoneNumber,
      message,
    });

    // Store in conversation history
    await this.conversationService.storeMessage({
      userId,
      direction: 'outbound',
      messageText: message,
      whatsappMessageId: result.messageId,
      detectedIntent: metadata?.intent as any,
      relatedReminderId: metadata?.relatedId,
    });
  }

  /**
   * Helper: Start a multi-step flow
   */
  protected async startFlow(userId: string, flowName: string, initialData: Record<string, any> = {}) {
    logger.info({ userId, agent: this.type, flowName }, 'Starting flow');
    await this.agentStateService.startFlow(userId, flowName, initialData);
  }

  /**
   * Helper: Update flow data
   */
  protected async updateFlowData(userId: string, data: Record<string, any>) {
    await this.agentStateService.updateFlowData(userId, data);
  }

  /**
   * Helper: Complete flow
   */
  protected async completeFlow(userId: string) {
    logger.info({ userId, agent: this.type }, 'Completing flow');
    await this.agentStateService.completeFlow(userId);
  }

  /**
   * Helper: Get flow data
   */
  protected async getFlowData(userId: string): Promise<Record<string, any> | null> {
    return this.agentStateService.getFlowData(userId);
  }

  /**
   * Helper: Extract numbers from text
   */
  protected extractNumbers(text: string): number[] {
    const matches = text.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Helper: Extract currency amounts (₹1200, Rs.500, 1200 rupees)
   */
  protected extractAmount(text: string): number | null {
    // Match patterns like: ₹1200, Rs.500, 1200 rupees, rs 500
    const patterns = [
      /₹\s*(\d+)/,
      /rs\.?\s*(\d+)/i,
      /(\d+)\s*(?:₹|rs\.?|rupees?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }

    return null;
  }

  /**
   * Helper: Check if message is a greeting
   */
  protected isGreeting(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();
    return /^(hi|hello|hey|hola|namaste|good morning|good evening|greetings)$/i.test(lowerMessage);
  }
}

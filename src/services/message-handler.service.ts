import { User } from '@prisma/client';
import { ConversationService } from './conversation.service';
import { AgentRouter } from './agent-router.service';
import { OnboardingAgent } from '../agents/onboarding-agent';
import { ConversationAgent } from '../agents/conversation-agent';
import { AgentStateService } from './agent-state.service';
import { logger } from '../config/logger';

/**
 * Core message handling orchestrator
 * Routes messages to appropriate agents via AgentRouter
 *
 * Agent Architecture:
 * 1. OnboardingAgent - Handles first-time user setup only
 * 2. ConversationAgent - Main orchestrator, handles ALL user interaction after onboarding
 *    - Uses DateTimeAgent internally for time parsing
 *    - Uses ReminderAgent internally for storage (CRUD)
 */
export class MessageHandler {
  private conversationService: ConversationService;
  private agentRouter: AgentRouter;
  private agentStateService: AgentStateService;

  constructor() {
    this.conversationService = new ConversationService();
    this.agentRouter = new AgentRouter();
    this.agentStateService = new AgentStateService();

    // Register user-facing agents only
    // Onboarding has highest priority (checks if user setup is complete)
    this.agentRouter.registerAgent(new OnboardingAgent());

    // Conversation agent is the main orchestrator (handles everything after onboarding)
    this.agentRouter.registerAgent(new ConversationAgent());

    logger.info('Message handler initialized with OnboardingAgent and ConversationAgent');
  }

  /**
   * Handle incoming user message
   * Routes to appropriate agent based on context and message content
   */
  async handleUserMessage(user: User, messageText: string): Promise<void> {
    logger.info({ userId: user.id, messageText }, 'Handling user message');

    try {
      // Store inbound message
      await this.conversationService.storeMessage({
        userId: user.id,
        direction: 'inbound',
        messageText,
      });

      // Route to appropriate agent
      const { agent, context } = await this.agentRouter.route(user, messageText);

      logger.info(
        { userId: user.id, agentType: agent.type, agentName: agent.name },
        'Message routed to agent'
      );

      // Agent processes the message
      const response = await agent.handle(context);

      // Handle agent switching if requested
      if (response.shouldSwitchAgent) {
        await this.agentStateService.switchAgent(user.id, response.shouldSwitchAgent);
        logger.info(
          { userId: user.id, newAgent: response.shouldSwitchAgent },
          'Switched to new agent'
        );
      }

      // If flow is complete, clear it
      if (response.flowComplete) {
        const state = await this.agentStateService.getState(user.id);
        if (state?.activeFlow) {
          await this.agentStateService.completeFlow(user.id);
          logger.info({ userId: user.id }, 'Flow completed');
        }
      }

      logger.info({ userId: user.id }, 'Message handled successfully');
    } catch (error) {
      logger.error({ error, userId: user.id }, 'Error handling message');

      // Send error message to user
      const { WhatsAppService } = await import('./whatsapp.service');
      const service = new WhatsAppService();
      await service.sendTextMessage({
        to: user.phoneNumber,
        message: "Sorry, something went wrong. Please try again.",
      });
    }
  }

  /**
   * Handle WhatsApp message status updates
   */
  async handleStatusUpdate(messageId: string, status: string): Promise<void> {
    logger.debug({ messageId, status }, 'Handling status update');

    // Update reminder status if this is a reminder notification
    // This could be enhanced to track delivery/read status
    if (status === 'delivered' || status === 'read') {
      // Find reminder by whatsapp message ID and update status
      // Implementation can be added based on requirements
    }
  }
}

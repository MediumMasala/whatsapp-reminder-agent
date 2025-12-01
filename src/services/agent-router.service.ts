import { User } from '@prisma/client';
import { AgentType, AgentContext, IAgent, RoutingDecision } from '../types/agents';
import { AgentStateService } from './agent-state.service';
import { ConversationService } from './conversation.service';
import { logger } from '../config/logger';

/**
 * Agent Router
 *
 * The central orchestrator that:
 * 1. Analyzes incoming messages
 * 2. Determines which agent should handle them
 * 3. Routes to the appropriate agent
 * 4. Manages agent state transitions
 */
export class AgentRouter {
  private agents: Map<AgentType, IAgent> = new Map();
  private agentStateService: AgentStateService;
  private conversationService: ConversationService;

  constructor() {
    this.agentStateService = new AgentStateService();
    this.conversationService = new ConversationService();
  }

  /**
   * Register an agent
   */
  registerAgent(agent: IAgent): void {
    logger.info({ agentType: agent.type, agentName: agent.name }, 'Registering agent');
    this.agents.set(agent.type, agent);
  }

  /**
   * Main routing logic
   */
  async route(user: User, message: string): Promise<{ agent: IAgent; context: AgentContext }> {
    logger.info({ userId: user.id, message }, 'Routing message');

    // Build context
    const context = await this.buildContext(user, message);

    // Get current agent state
    const currentState = await this.agentStateService.getState(user.id);

    // Decision logic
    let selectedAgent: IAgent;

    if (!user.onboardingComplete) {
      // Always route to onboarding if not complete
      selectedAgent = this.getAgent('onboarding');
      logger.info({ userId: user.id }, 'Routing to onboarding - not complete');
    } else if (currentState?.activeFlow) {
      // User is in the middle of a flow - stick with current agent
      const currentAgentType = currentState.currentAgent as AgentType;
      selectedAgent = this.getAgent(currentAgentType);
      logger.info(
        { userId: user.id, agent: currentAgentType, flow: currentState.activeFlow },
        'Routing to current agent - active flow'
      );
    } else {
      // Determine best agent based on message content
      const decision = await this.determineAgent(context);
      selectedAgent = this.getAgent(decision.agent);
      logger.info(
        { userId: user.id, agent: decision.agent, reason: decision.reason },
        'Routing based on message analysis'
      );

      // Update agent state if switching
      if (decision.agent !== currentState?.currentAgent) {
        await this.agentStateService.setAgent(user.id, decision.agent);
      }
    }

    return { agent: selectedAgent, context };
  }

  /**
   * Build agent context from user and message
   */
  private async buildContext(user: User, message: string): Promise<AgentContext> {
    // Get conversation history
    const historyData = await this.conversationService.getContext(user.id, 10);

    // Get current state
    const state = await this.agentStateService.getState(user.id);

    return {
      user,
      message,
      conversationHistory: historyData.recentMessages,
      currentFlow: state?.activeFlow || undefined,
      flowData: (state?.flowData as Record<string, any>) || undefined,
    };
  }

  /**
   * Determine which agent should handle the message
   */
  private async determineAgent(context: AgentContext): Promise<RoutingDecision> {
    const message = context.message.toLowerCase().trim();

    // Explicit commands
    if (/^(remind|reminder|set reminder|create reminder)/i.test(message)) {
      return {
        agent: 'reminder',
        confidence: 1.0,
        reason: 'Explicit reminder command',
      };
    }

    if (/^(split|expense|spent|paid|bill)/i.test(message)) {
      return {
        agent: 'splitwise',
        confidence: 1.0,
        reason: 'Explicit expense/split command',
      };
    }

    // Pattern-based detection

    // Reminder patterns: time expressions
    if (/\b(tomorrow|today|tonight|morning|evening|afternoon|night|am|pm|:\d{2}|\d{1,2}:\d{2})\b/i.test(message)) {
      return {
        agent: 'reminder',
        confidence: 0.85,
        reason: 'Contains time/date expressions',
      };
    }

    // Expense patterns: currency or numbers + context
    if (/(₹|rs\.?|rupees?)\s*\d+|\d+\s*(₹|rs\.?|rupees?)/i.test(message) ||
        (/\d{2,}/.test(message) && /(spent|paid|cost|bill|dinner|lunch|food)/i.test(message))) {
      return {
        agent: 'splitwise',
        confidence: 0.80,
        reason: 'Contains expense/payment context',
      };
    }

    // Ask each agent if they can handle
    for (const [type, agent] of this.agents) {
      if (type === 'onboarding') continue; // Skip onboarding

      const canHandle = await agent.canHandle(context);
      if (canHandle) {
        return {
          agent: type,
          confidence: 0.70,
          reason: `Agent ${agent.name} indicated it can handle`,
        };
      }
    }

    // Default: reminder agent (safest fallback)
    return {
      agent: 'reminder',
      confidence: 0.50,
      reason: 'Default fallback',
    };
  }

  /**
   * Get agent by type
   */
  private getAgent(type: AgentType): IAgent {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error(`Agent not found: ${type}`);
    }
    return agent;
  }

  /**
   * Get all registered agents
   */
  getAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }
}

import { User } from '@prisma/client';

/**
 * Agent Types
 */
export type AgentType = 'onboarding' | 'reminder' | 'splitwise' | 'conversation' | 'datetime';

/**
 * Agent Response
 * What an agent returns after processing a message
 */
export interface AgentResponse {
  message: string;
  shouldSwitchAgent?: AgentType;
  flowComplete?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Agent Context
 * What every agent receives when processing a message
 */
export interface AgentContext {
  user: User;
  message: string;
  conversationHistory: Array<{
    direction: 'inbound' | 'outbound';
    messageText: string;
    timestamp: Date;
    detectedIntent?: string;
  }>;
  currentFlow?: string;
  flowData?: Record<string, any>;
}

/**
 * Base Agent Interface
 * All agents must implement this
 */
export interface IAgent {
  readonly type: AgentType;
  readonly name: string;

  /**
   * Determine if this agent should handle the message
   */
  canHandle(context: AgentContext): Promise<boolean>;

  /**
   * Process the message and return response
   */
  handle(context: AgentContext): Promise<AgentResponse>;

  /**
   * Get agent personality/description
   */
  getDescription(): string;
}

/**
 * Agent Routing Decision
 */
export interface RoutingDecision {
  agent: AgentType;
  confidence: number;
  reason: string;
}

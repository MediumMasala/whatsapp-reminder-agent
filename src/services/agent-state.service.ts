import { getPrismaClient } from '../config/database';
import { logger } from '../config/logger';
import { AgentType } from '../types/agents';

export class AgentStateService {
  private prisma = getPrismaClient();

  /**
   * Get current agent state for user
   */
  async getState(userId: string) {
    return this.prisma.agentState.findUnique({
      where: { userId },
    });
  }

  /**
   * Set current agent for user
   */
  async setAgent(userId: string, agent: AgentType) {
    logger.info({ userId, agent }, 'Setting active agent');

    return this.prisma.agentState.upsert({
      where: { userId },
      create: {
        userId,
        currentAgent: agent,
      },
      update: {
        currentAgent: agent,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Start a multi-step flow
   */
  async startFlow(userId: string, flowName: string, initialData: Record<string, any> = {}) {
    logger.info({ userId, flowName }, 'Starting flow');

    const state = await this.getState(userId);
    if (!state) {
      throw new Error('Agent state not found. Set agent first.');
    }

    return this.prisma.agentState.update({
      where: { userId },
      data: {
        activeFlow: flowName,
        flowData: initialData,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Update flow data
   */
  async updateFlowData(userId: string, data: Record<string, any>) {
    const state = await this.getState(userId);
    if (!state || !state.activeFlow) {
      logger.warn({ userId }, 'Attempted to update flow data with no active flow');
      return;
    }

    const currentData = (state.flowData as Record<string, any>) || {};
    const mergedData = { ...currentData, ...data };

    return this.prisma.agentState.update({
      where: { userId },
      data: {
        flowData: mergedData,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Complete and clear active flow
   */
  async completeFlow(userId: string) {
    logger.info({ userId }, 'Completing flow');

    return this.prisma.agentState.update({
      where: { userId },
      data: {
        activeFlow: null,
        flowData: {},
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Get flow data
   */
  async getFlowData(userId: string): Promise<Record<string, any> | null> {
    const state = await this.getState(userId);
    return (state?.flowData as Record<string, any>) || null;
  }

  /**
   * Switch to a different agent and optionally start a flow
   */
  async switchAgent(userId: string, newAgent: AgentType, flowName?: string) {
    logger.info({ userId, newAgent, flowName }, 'Switching agent');

    return this.prisma.agentState.upsert({
      where: { userId },
      create: {
        userId,
        currentAgent: newAgent,
        activeFlow: flowName || null,
        flowData: {},
      },
      update: {
        currentAgent: newAgent,
        activeFlow: flowName || null,
        flowData: {},
        lastUpdated: new Date(),
      },
    });
  }
}

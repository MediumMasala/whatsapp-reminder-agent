import { AgentType, IAgent, AgentContext, AgentResponse } from '../types/agents';
import { BaseAgent } from './base-agent';
import { getPrismaClient } from '../config/database';
import { logger } from '../config/logger';

/**
 * Onboarding Agent
 *
 * Handles first-time user setup:
 * - Greets new users
 * - Collects their name
 * - Generates culturally-aware sass based on name ethnicity
 * - Completes profile setup
 * - Transitions to main system
 */
export class OnboardingAgent extends BaseAgent implements IAgent {
  readonly type: AgentType = 'onboarding';
  readonly name: string = 'Onboarding Agent';
  private prisma = getPrismaClient();

  /**
   * Check if this agent should handle the message
   * Always handles if user hasn't completed onboarding
   */
  async canHandle(context: AgentContext): Promise<boolean> {
    return !context.user.onboardingComplete;
  }

  /**
   * Handle onboarding flow
   */
  async handle(context: AgentContext): Promise<AgentResponse> {
    const { user, message, currentFlow, flowData } = context;

    logger.info({ userId: user.id, flow: currentFlow }, 'Onboarding agent handling message');

    // Step 1: Initial greeting
    if (!currentFlow) {
      await this.startOnboarding(user.phoneNumber, user.id);
      return {
        message: '', // Already sent in startOnboarding
        flowComplete: false,
      };
    }

    // Step 2: Name collection
    if (currentFlow === 'onboarding' && !flowData?.name) {
      return await this.collectName(user.phoneNumber, user.id, message);
    }

    // Step 3: Complete onboarding
    if (currentFlow === 'onboarding' && flowData?.name) {
      return await this.completeOnboarding(user.phoneNumber, user.id, flowData.name as string);
    }

    // Fallback
    return {
      message: "Let's get you set up! What's your name?",
    };
  }

  /**
   * Get agent description
   */
  getDescription(): string {
    return 'Handles new user onboarding and profile setup with cultural flair';
  }

  /**
   * Start onboarding flow
   */
  private async startOnboarding(phoneNumber: string, userId: string): Promise<void> {
    logger.info({ userId }, 'Starting onboarding flow');

    // STEP 1: Send exact greeting
    const greetingMsg = `hey, my name is Pin Me. How may I help you? How may I assist you?`;

    await this.sendMessage(phoneNumber, userId, greetingMsg, {
      intent: 'onboarding_start',
    });

    // STEP 2: Immediately ask for name in a separate message
    const nameAskMsg = `also, what should I call you? what's your name?`;

    await this.sendMessage(phoneNumber, userId, nameAskMsg, {
      intent: 'onboarding_ask_name',
    });

    await this.startFlow(userId, 'onboarding');
  }

  /**
   * Collect and validate name
   */
  private async collectName(
    phoneNumber: string,
    userId: string,
    message: string
  ): Promise<AgentResponse> {
    let name = message.trim();

    // Extract first name from common patterns
    name = name
      .replace(/^(my name is|i'm|i am|this is|call me)\s+/i, '')
      .trim();

    // Get first name if multiple words
    const firstName = name.split(/\s+/)[0];

    // Basic validation
    if (firstName.length < 2) {
      await this.sendMessage(
        phoneNumber,
        userId,
        "I promise I'm not your HR. just tell me your name 😄",
        { intent: 'onboarding_name_retry' }
      );
      return { message: '', flowComplete: false };
    }

    if (firstName.length > 30) {
      await this.sendMessage(
        phoneNumber,
        userId,
        "that's... quite the name. maybe just give me the short version?",
        { intent: 'onboarding_name_retry' }
      );
      return { message: '', flowComplete: false };
    }

    // Store name in flow data
    await this.updateFlowData(userId, { name: firstName });

    // Generate light name tease
    const nameTease = this.generateNameTease(firstName);

    // Send confirmation with tease + brief explanation
    const confirmMsg = `${firstName}, ${nameTease}\n\nI'm your WhatsApp reminder agent – tell me what you don't want to forget and I'll pin it for you.`;

    await this.sendMessage(phoneNumber, userId, confirmMsg, {
      intent: 'onboarding_complete',
    });

    return { message: '', flowComplete: true };
  }

  /**
   * Complete onboarding and mark user as ready
   */
  private async completeOnboarding(
    _phoneNumber: string,
    userId: string,
    name: string
  ): Promise<AgentResponse> {
    logger.info({ userId, name }, 'Completing onboarding');

    // Update user profile
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        onboardingComplete: true,
      },
    });

    // Complete the flow
    await this.completeFlow(userId);

    // Switch to reminder agent as default
    await this.agentStateService.setAgent(userId, 'reminder');

    logger.info({ userId }, 'Onboarding completed successfully');

    return {
      message: '', // Already sent in collectName
      flowComplete: true,
      shouldSwitchAgent: 'reminder',
    };
  }

  /**
   * Generate light, playful name tease
   * Short, snappy, friendly - like a college senior teasing a junior
   */
  private generateNameTease(name: string): string {
    const lowerName = name.toLowerCase();

    // Common Indian names - light, friendly teasing
    const commonIndianNames = ['raj', 'amit', 'priya', 'rahul', 'anjali', 'vikram', 'neha', 'rohit', 'arjun', 'yash', 'riya', 'aarav'];
    if (commonIndianNames.some(n => lowerName.startsWith(n))) {
      const teases = [
        "nice. your parents definitely didn't overthink that one 😄",
        "solid name. your parents clearly speedran the baby-naming process.",
        "elite default setting for Indian kids 😂",
        "classic choice. your parents went with the crowd favourite.",
        "huh. sounds like someone with way too many pending tasks already.",
      ];
      return teases[Math.floor(Math.random() * teases.length)];
    }

    // Power/strong sounding names
    if (/^(vikram|arjun|rohan|aditya|karan)/i.test(lowerName)) {
      const powerTeases = [
        "is such a power name. sounds like someone who's always late to meetings.",
        "nice. that's a main-character energy name right there.",
        "sounds like you're about to star in a Bollywood movie or forget your keys. probably both.",
      ];
      return powerTeases[Math.floor(Math.random() * powerTeases.length)];
    }

    // Soft/elegant names
    if (/^(priya|kavya|anjali|riya|sara|isha)/i.test(lowerName)) {
      const elegantTeases = [
        "is such a strong main-character name, I love it.",
        "nice. sounds like someone who has their life together. let's fix that illusion.",
        "elegant choice. your parents clearly had good taste.",
      ];
      return elegantTeases[Math.floor(Math.random() * elegantTeases.length)];
    }

    // Default - generic light teasing
    const genericTeases = [
      "cool name. I'll try not to forget it like you forget everything else.",
      "nice! sounds like someone who definitely needs a reminder app.",
      "solid choice. your parents clearly thought that through.",
      "I like it! now let's make sure you remember stuff for once.",
      "huh. sounds like you've got your hands full already.",
    ];
    return genericTeases[Math.floor(Math.random() * genericTeases.length)];
  }
}

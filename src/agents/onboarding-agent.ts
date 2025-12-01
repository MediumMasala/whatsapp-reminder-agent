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

    const greetingMsg = `👋 Hey there! Welcome to your new productivity companion.\n\nI'm here to help you remember things and split expenses with friends.\n\nBut first, what should I call you?`;

    await this.sendMessage(phoneNumber, userId, greetingMsg, {
      intent: 'onboarding_start',
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
    const name = message.trim();

    // Basic validation
    if (name.length < 2) {
      await this.sendMessage(
        phoneNumber,
        userId,
        "Hmm, that seems a bit short. Could you tell me your full name?",
        { intent: 'onboarding_name_retry' }
      );
      return { message: '', flowComplete: false };
    }

    if (name.length > 50) {
      await this.sendMessage(
        phoneNumber,
        userId,
        "That's quite a mouthful! Could you give me a shorter version I can use?",
        { intent: 'onboarding_name_retry' }
      );
      return { message: '', flowComplete: false };
    }

    // Store name in flow data
    await this.updateFlowData(userId, { name });

    // Generate sass comment based on name
    const sassComment = this.generateSassComment(name);

    const confirmMsg = `Nice to meet you, ${name}! ${sassComment}\n\nYou're all set! 🎉\n\nYou can now:\n• Set reminders (just tell me when and what)\n• Split expenses with friends (tell me who paid and how much)\n\nWhat would you like to do?`;

    await this.sendMessage(phoneNumber, userId, confirmMsg, {
      intent: 'onboarding_complete',
    });

    return { message: '', flowComplete: true };
  }

  /**
   * Complete onboarding and mark user as ready
   */
  private async completeOnboarding(
    phoneNumber: string,
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
   * Generate culturally-aware sass based on name
   * Uses simple heuristics to detect name origin and add personality
   */
  private generateSassComment(name: string): string {
    const lowerName = name.toLowerCase();

    // Indian names
    if (
      /^(raj|amit|priya|anjali|vikram|sanjay|deepak|neha|pooja|rohit|arjun|kavya|aditi|aarav|ishaan|yash|riya|saanvi|krishna|shiva|lakshmi|ganesh)/.test(
        lowerName
      )
    ) {
      const indianSass = [
        "Namaste! I promise I won't judge you for forgetting things... much. 🙏",
        "Chai time reminders coming right up! ☕",
        "I'll be more reliable than your neighborhood chaiwala! 😄",
        "Let's make sure you never miss cricket match timings again! 🏏",
      ];
      return indianSass[Math.floor(Math.random() * indianSass.length)];
    }

    // Western names
    if (
      /^(john|jane|michael|emily|david|sarah|chris|jessica|alex|emma|james|olivia|william|sophia)/.test(
        lowerName
      )
    ) {
      const westernSass = [
        "Awesome! I'll help you stay on top of things, unlike your New Year's resolutions. 😉",
        "Great! I'll be your digital sticky note that actually sticks around. 📝",
        "Perfect! Let's get you organized, shall we? ✨",
      ];
      return westernSass[Math.floor(Math.random() * westernSass.length)];
    }

    // Arabic names
    if (/^(mohammed|ahmed|fatima|ali|omar|aisha|hassan|zainab|khalid|maryam)/.test(lowerName)) {
      const arabicSass = [
        "Marhaba! I'll make sure you're always on time, even for Friday prayers! 🕌",
        "Welcome! I'll be more dependable than your morning qahwa. ☕",
        "Ahlan! Let's keep your schedule as organized as your spice collection! 🌶️",
      ];
      return arabicSass[Math.floor(Math.random() * arabicSass.length)];
    }

    // Chinese names
    if (/^(wei|li|wang|zhang|chen|liu|yang|huang|zhao|wu|xu|sun|ma|zhu|hu)/.test(lowerName)) {
      const chineseSass = [
        "你好! I'll help you remember everything, no fortune cookie needed! 🥠",
        "Welcome! I'm like your personal feng shui for time management! ⚡",
        "Great! I'll keep you organized like a perfectly balanced dim sum platter! 🥟",
      ];
      return chineseSass[Math.floor(Math.random() * chineseSass.length)];
    }

    // African names
    if (
      /^(amara|kofi|nia|kwame|zuri|jabari|ayana|malik|imani|sekou|nala|chiamaka)/.test(lowerName)
    ) {
      const africanSass = [
        "Jambo! I'll help you stay organized with the wisdom of your ancestors... and better tech! 😄",
        "Welcome! I'll be your digital griot, keeping track of everything! 📱",
        "Habari! Let's make sure you never miss a beat! 🎵",
      ];
      return africanSass[Math.floor(Math.random() * africanSass.length)];
    }

    // Latin American names
    if (
      /^(carlos|maria|jose|ana|luis|carmen|juan|elena|miguel|sofia|diego|isabella)/.test(lowerName)
    ) {
      const latinSass = [
        "¡Hola! I'll help you remember things faster than you can say 'mañana'! 🌮",
        "Welcome! I'll be more reliable than your abuela's cooking schedule! 👵",
        "¡Perfecto! Let's keep you on time, even if the party starts 'later'! 🎉",
      ];
      return latinSass[Math.floor(Math.random() * latinSass.length)];
    }

    // Japanese/Korean names
    if (/^(yuki|hiro|sakura|kenji|akira|yuki|min|ji|soo|hye|jun|kim|park|lee)/.test(lowerName)) {
      const asianSass = [
        "こんにちは! I'll help you stay kawaii-level organized! ✨",
        "Welcome! I'll be your personal productivity sensei! 🥋",
        "Perfect! Let's keep you on schedule like a Japanese train! 🚄",
      ];
      return asianSass[Math.floor(Math.random() * asianSass.length)];
    }

    // Default generic sass
    const genericSass = [
      "Great name! I'll help you remember all the things you're about to forget! 😉",
      "Perfect! I'll be your memory's best friend! 🧠",
      "Awesome! Let's make sure you never miss a thing! ⏰",
      "Love it! I'll keep you organized and on track! 🎯",
      "Nice! I'll be like that friend who always remembers your birthday! 🎂",
    ];
    return genericSass[Math.floor(Math.random() * genericSass.length)];
  }
}

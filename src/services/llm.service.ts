import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface IntentDetectionResult {
  intent: 'create_reminder' | 'list_reminders' | 'delete_reminder' | 'help' | 'greeting' | 'thanks' | 'unclear';
  confidence: number;
  reasoning?: string;
}

export interface ReminderExtractionResult {
  task: string;
  timeExpression?: string;
  hasTime: boolean;
  confidence: number;
}

export class LLMService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Detect user intent from message using GPT-4
   */
  async detectIntent(message: string, conversationHistory?: string[]): Promise<IntentDetectionResult> {
    try {
      const systemPrompt = `You are an intent classifier for Pin Me, a WhatsApp reminder bot.
Analyze the user's message and classify it into ONE of these intents:

1. **create_reminder** - User wants to set a reminder (e.g., "remind me to call mom", "tomorrow at 7pm meeting", "don't forget to pay bills")
2. **list_reminders** - User wants to see their reminders (e.g., "show my reminders", "what do I have pinned", "list all")
3. **delete_reminder** - User wants to cancel a reminder (e.g., "cancel reminder", "delete the first one", "remove all")
4. **help** - User needs help or asking what you can do (e.g., "what can you do", "help", "how does this work")
5. **greeting** - Simple greeting (e.g., "hi", "hello", "hey")
6. **thanks** - Thanking or appreciation (e.g., "thanks", "thank you", "appreciate it")
7. **unclear** - Message doesn't fit any category or is ambiguous

Respond ONLY with valid JSON in this format:
{"intent": "create_reminder", "confidence": 0.95, "reasoning": "brief explanation"}`;

      const userPrompt = conversationHistory && conversationHistory.length > 0
        ? `Recent conversation:\n${conversationHistory.join('\n')}\n\nLatest message: "${message}"`
        : `Message: "${message}"`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn('Empty response from OpenAI for intent detection');
        return { intent: 'unclear', confidence: 0 };
      }

      const result = JSON.parse(content) as IntentDetectionResult;
      logger.info({ message, result }, 'Intent detected via LLM');

      return result;
    } catch (error) {
      logger.error({ error, message }, 'Error detecting intent with LLM');
      // Fallback to unclear intent
      return { intent: 'unclear', confidence: 0 };
    }
  }

  /**
   * Extract reminder task and time from message using GPT-4
   */
  async extractReminderData(message: string): Promise<ReminderExtractionResult> {
    try {
      const systemPrompt = `You are a reminder parser for Pin Me, a WhatsApp reminder bot.
Extract the task and time expression from the user's message.

Examples:
- "remind me to call mom tomorrow at 7pm" → task: "call mom", time: "tomorrow at 7pm"
- "pay bills on the 15th" → task: "pay bills", time: "on the 15th"
- "don't forget to buy groceries in 2 hours" → task: "buy groceries", time: "in 2 hours"
- "meeting at 3pm" → task: "meeting", time: "at 3pm"
- "remind me about the doctor" → task: "about the doctor", hasTime: false

Respond ONLY with valid JSON in this format:
{"task": "extracted task", "timeExpression": "time expression or null", "hasTime": true/false, "confidence": 0.9}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Message: "${message}"` },
        ],
        temperature: 0.2,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        logger.warn('Empty response from OpenAI for reminder extraction');
        return { task: '', hasTime: false, confidence: 0 };
      }

      const result = JSON.parse(content) as ReminderExtractionResult;
      logger.info({ message, result }, 'Reminder data extracted via LLM');

      return result;
    } catch (error) {
      logger.error({ error, message }, 'Error extracting reminder data with LLM');
      return { task: '', hasTime: false, confidence: 0 };
    }
  }

  /**
   * Generate a natural, contextual response
   */
  async generateResponse(
    context: string,
    intent: string,
    userMessage: string
  ): Promise<string> {
    try {
      const systemPrompt = `You are Pin Me, a friendly WhatsApp reminder bot.
Your personality:
- Casual, friendly, like talking to a college buddy
- Use lowercase, minimal punctuation
- Short responses (1-2 sentences max)
- Light humor and sass when appropriate
- Never use emojis unless the context really calls for it

Generate a natural response based on the context and intent.`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context: ${context}\nIntent: ${intent}\nUser said: "${userMessage}"\n\nGenerate response:` },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        logger.warn('Empty response from OpenAI for response generation');
        return "hmm, I didn't quite catch that. could you rephrase?";
      }

      logger.info({ userMessage, intent, response: content }, 'Response generated via LLM');
      return content;
    } catch (error) {
      logger.error({ error }, 'Error generating response with LLM');
      return "sorry, something went wrong. can you try again?";
    }
  }
}

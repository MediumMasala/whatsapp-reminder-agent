import { Request, Response } from 'express';
import { WhatsAppWebhookPayload, WhatsAppMessage } from '../types';
import { UserService } from '../services/user.service';
import { ConversationService } from '../services/conversation.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { MessageHandler } from '../services/message-handler.service';
import { logger } from '../config/logger';

export class WebhookController {
  private userService: UserService;
  private conversationService: ConversationService;
  private whatsappService: WhatsAppService;
  private messageHandler: MessageHandler;

  constructor() {
    this.userService = new UserService();
    this.conversationService = new ConversationService();
    this.whatsappService = new WhatsAppService();
    this.messageHandler = new MessageHandler();
  }

  /**
   * Handle incoming WhatsApp webhook messages
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as WhatsAppWebhookPayload;

      logger.info({ payload }, 'Received webhook');

      // Acknowledge immediately
      res.status(200).json({ success: true });

      // Process messages asynchronously
      await this.processWebhookPayload(payload);
    } catch (error) {
      logger.error({ error }, 'Error handling webhook');
      // Still return 200 to prevent WhatsApp from retrying
      res.status(200).json({ success: false });
    }
  }

  private async processWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          // Handle incoming messages
          if (change.value.messages) {
            for (const message of change.value.messages) {
              await this.processIncomingMessage(message, change.value.contacts);
            }
          }

          // Handle message status updates
          if (change.value.statuses) {
            for (const status of change.value.statuses) {
              await this.processStatusUpdate(status);
            }
          }
        }
      }
    }
  }

  private async processIncomingMessage(
    message: WhatsAppMessage,
    contacts?: Array<{ profile: { name: string }; wa_id: string }>
  ): Promise<void> {
    try {
      const phoneNumber = message.from;
      const messageText = message.text.body;
      const whatsappMessageId = message.id;

      logger.info({ phoneNumber, messageText }, 'Processing incoming message');

      // Find or create user
      const contactName = contacts?.find(c => c.wa_id === phoneNumber)?.profile.name;
      const user = await this.userService.findOrCreateUser(phoneNumber, contactName);

      // Store inbound message in conversation history
      await this.conversationService.storeMessage({
        userId: user.id,
        direction: 'inbound',
        messageText,
        whatsappMessageId,
      });

      // Mark message as read
      await this.whatsappService.markAsRead(whatsappMessageId);

      // Handle the message and send response
      await this.messageHandler.handleUserMessage(user, messageText);
    } catch (error) {
      logger.error({ error, message }, 'Error processing incoming message');
    }
  }

  private async processStatusUpdate(status: {
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
  }): Promise<void> {
    try {
      logger.info({ status }, 'Processing status update');

      // Update reminder status based on WhatsApp message status
      // This will be handled by the message handler service
      await this.messageHandler.handleStatusUpdate(status.id, status.status);
    } catch (error) {
      logger.error({ error, status }, 'Error processing status update');
    }
  }
}

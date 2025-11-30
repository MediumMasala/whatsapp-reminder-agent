import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { SendMessageInput } from '../types';

export class WhatsAppService {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor() {
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    this.client = axios.create({
      baseURL: `${env.WHATSAPP_API_URL}/${this.phoneNumberId}`,
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send a text message via WhatsApp Cloud API
   */
  async sendTextMessage(input: SendMessageInput): Promise<{
    messageId: string;
    success: boolean;
  }> {
    try {
      logger.info({ to: input.to }, 'Sending WhatsApp message');

      const response = await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: input.to,
        type: 'text',
        text: {
          preview_url: false,
          body: input.message,
        },
      });

      const messageId = response.data.messages[0].id;

      logger.info({ messageId, to: input.to }, 'WhatsApp message sent successfully');

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      logger.error({ error, to: input.to }, 'Failed to send WhatsApp message');

      if (axios.isAxiosError(error)) {
        throw new Error(
          `WhatsApp API error: ${error.response?.data?.error?.message || error.message}`
        );
      }

      throw error;
    }
  }

  /**
   * Send a template message (required for messages outside 24h window)
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    parameters: string[]
  ): Promise<{ messageId: string; success: boolean }> {
    try {
      logger.info({ to, templateName }, 'Sending WhatsApp template message');

      const response = await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en',
          },
          components: [
            {
              type: 'body',
              parameters: parameters.map(p => ({
                type: 'text',
                text: p,
              })),
            },
          ],
        },
      });

      const messageId = response.data.messages[0].id;

      logger.info(
        { messageId, to, templateName },
        'WhatsApp template message sent successfully'
      );

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      logger.error(
        { error, to, templateName },
        'Failed to send WhatsApp template message'
      );

      if (axios.isAxiosError(error)) {
        throw new Error(
          `WhatsApp API error: ${error.response?.data?.error?.message || error.message}`
        );
      }

      throw error;
    }
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post('/messages', {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });

      logger.debug({ messageId }, 'Marked message as read');
    } catch (error) {
      logger.warn({ error, messageId }, 'Failed to mark message as read');
    }
  }
}

// User types
export interface CreateUserInput {
  phoneNumber: string;
  name?: string;
  timezone?: string;
}

// Reminder types
export type ReminderStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface CreateReminderInput {
  userId: string;
  reminderText: string;
  scheduledTime: Date;
  metadata?: Record<string, any>;
}

export interface UpdateReminderInput {
  status?: ReminderStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  whatsappMsgId?: string;
}

// Conversation types
export type ConversationDirection = 'inbound' | 'outbound';

export type DetectedIntent =
  | 'greeting'
  | 'create_reminder'
  | 'list_reminders'
  | 'cancel_reminder'
  | 'help'
  | 'unknown';

export interface CreateConversationInput {
  userId: string;
  direction: ConversationDirection;
  messageText: string;
  whatsappMessageId?: string;
  detectedIntent?: DetectedIntent;
  extractedData?: Record<string, any>;
  activeFlow?: string;
  relatedReminderId?: string;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  recentMessages: Array<{
    direction: ConversationDirection;
    messageText: string;
    timestamp: Date;
    detectedIntent?: DetectedIntent;
  }>;
  lastIntent?: DetectedIntent;
  lastActiveFlow?: string;
  lastReminderId?: string;
}

// WhatsApp types
export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface SendMessageInput {
  to: string;
  message: string;
  conversationId?: string;
}

// Parser types
export interface ParsedReminder {
  text: string;
  scheduledTime: Date;
  confidence: number;
  extractedData: {
    rawTimeExpression?: string;
    parsedDate?: string;
    parsedTime?: string;
  };
}

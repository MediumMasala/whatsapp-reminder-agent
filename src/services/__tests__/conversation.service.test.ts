import { ConversationService } from '../conversation.service';
import { ConversationRepository } from '../../repositories/conversation.repository';

// Mock the repository
jest.mock('../../repositories/conversation.repository');

describe('ConversationService', () => {
  let service: ConversationService;
  let mockRepository: jest.Mocked<ConversationRepository>;

  beforeEach(() => {
    mockRepository = new ConversationRepository() as jest.Mocked<ConversationRepository>;
    service = new ConversationService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeMessage', () => {
    it('should store an inbound message', async () => {
      const input = {
        userId: 'user-123',
        direction: 'inbound' as const,
        messageText: 'Remind me tomorrow at 9am',
        whatsappMessageId: 'msg-123',
        detectedIntent: 'create_reminder' as const,
      };

      const mockConversation = {
        id: 'conv-123',
        ...input,
        timestamp: new Date(),
        extractedData: null,
        activeFlow: null,
        relatedReminderId: null,
        metadata: null,
      };

      mockRepository.create.mockResolvedValue(mockConversation as any);

      const result = await service.storeMessage(input);

      expect(result).toEqual(mockConversation);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });

    it('should store an outbound message', async () => {
      const input = {
        userId: 'user-123',
        direction: 'outbound' as const,
        messageText: 'Reminder set for tomorrow at 9am',
        whatsappMessageId: 'msg-124',
      };

      const mockConversation = {
        id: 'conv-124',
        ...input,
        timestamp: new Date(),
        detectedIntent: null,
        extractedData: null,
        activeFlow: null,
        relatedReminderId: null,
        metadata: null,
      };

      mockRepository.create.mockResolvedValue(mockConversation as any);

      const result = await service.storeMessage(input);

      expect(result).toEqual(mockConversation);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe('getContext', () => {
    it('should return conversation context with recent messages', async () => {
      const mockMessages = [
        {
          id: 'conv-1',
          userId: 'user-123',
          direction: 'inbound',
          messageText: 'Remind me tomorrow',
          timestamp: new Date('2025-01-01T10:00:00Z'),
          detectedIntent: 'create_reminder',
          whatsappMessageId: null,
          extractedData: null,
          activeFlow: 'create_reminder_flow',
          relatedReminderId: 'reminder-123',
          metadata: null,
        },
        {
          id: 'conv-2',
          userId: 'user-123',
          direction: 'outbound',
          messageText: 'When should I remind you?',
          timestamp: new Date('2025-01-01T10:00:10Z'),
          detectedIntent: null,
          whatsappMessageId: 'msg-123',
          extractedData: null,
          activeFlow: null,
          relatedReminderId: null,
          metadata: null,
        },
      ];

      mockRepository.findRecentByUserId.mockResolvedValue(mockMessages as any);

      const context = await service.getContext('user-123', 10);

      expect(context.recentMessages).toHaveLength(2);
      expect(context.lastIntent).toBe('create_reminder');
      expect(context.lastActiveFlow).toBe('create_reminder_flow');
      expect(context.lastReminderId).toBe('reminder-123');
    });

    it('should handle empty conversation history', async () => {
      mockRepository.findRecentByUserId.mockResolvedValue([]);

      const context = await service.getContext('user-123', 10);

      expect(context.recentMessages).toHaveLength(0);
      expect(context.lastIntent).toBeUndefined();
      expect(context.lastActiveFlow).toBeUndefined();
      expect(context.lastReminderId).toBeUndefined();
    });
  });

  describe('getActiveReminderContext', () => {
    it('should detect active reminder flow', async () => {
      const mockMessages = [
        {
          id: 'conv-1',
          userId: 'user-123',
          direction: 'inbound',
          messageText: 'Remind me to pay rent',
          timestamp: new Date(),
          detectedIntent: 'create_reminder',
          whatsappMessageId: null,
          extractedData: null,
          activeFlow: null,
          relatedReminderId: null,
          metadata: null,
        },
      ];

      mockRepository.findRecentByUserId.mockResolvedValue(mockMessages as any);

      const context = await service.getActiveReminderContext('user-123');

      expect(context.hasActiveReminderFlow).toBe(true);
      expect(context.partialReminderText).toBe('Remind me to pay rent');
      expect(context.lastIntent).toBe('create_reminder');
    });

    it('should return false when no active reminder flow', async () => {
      const mockMessages = [
        {
          id: 'conv-1',
          userId: 'user-123',
          direction: 'inbound',
          messageText: 'List my reminders',
          timestamp: new Date(),
          detectedIntent: 'list_reminders',
          whatsappMessageId: null,
          extractedData: null,
          activeFlow: null,
          relatedReminderId: null,
          metadata: null,
        },
      ];

      mockRepository.findRecentByUserId.mockResolvedValue(mockMessages as any);

      const context = await service.getActiveReminderContext('user-123');

      expect(context.hasActiveReminderFlow).toBe(false);
      expect(context.lastIntent).toBe('list_reminders');
    });
  });
});

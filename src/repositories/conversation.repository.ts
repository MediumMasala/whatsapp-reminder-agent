import { getPrismaClient } from '../config/database';
import { CreateConversationInput } from '../types';
import { Conversation } from '@prisma/client';

export class ConversationRepository {
  private prisma = getPrismaClient();

  async create(input: CreateConversationInput): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: {
        userId: input.userId,
        direction: input.direction,
        messageText: input.messageText,
        whatsappMessageId: input.whatsappMessageId,
        detectedIntent: input.detectedIntent,
        extractedData: input.extractedData as any,
        activeFlow: input.activeFlow,
        relatedReminderId: input.relatedReminderId,
        metadata: input.metadata as any,
      },
    });
  }

  async findRecentByUserId(
    userId: string,
    limit: number = 20
  ): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findLastInboundMessage(userId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: {
        userId,
        direction: 'inbound',
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByActiveFlow(
    userId: string,
    activeFlow: string
  ): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: {
        userId,
        activeFlow,
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });
  }

  async findByIntent(
    userId: string,
    intent: string,
    limit: number = 5
  ): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: {
        userId,
        detectedIntent: intent,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async countByUser(userId: string): Promise<number> {
    return this.prisma.conversation.count({
      where: { userId },
    });
  }
}

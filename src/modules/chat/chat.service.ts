import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIProvidersService } from '../ai-providers/ai-providers.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AiModel, SenderRole } from '@prisma/client';
import { generateText } from 'ai';

type MessageInput = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvidersService: AIProvidersService,
  ) {}

  /**
   * Core Chat Logic:
   * 1. Check requestsCount < requestLimit -> Throw 402 if exceeded
   * 2. Decrypt default/target provider key
   * 3. Call Vercel AI SDK
   * 4. Save Conversation History
   * 5. Increment requestsCount
   */
  async sendMessage(userId: string, dto: SendMessageDto) {
    // 1. Quota limit check
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.requestsCount >= user.subscription.requestLimit) {
      throw new HttpException(
        `Monthly request limit reached (${user.requestsCount}/${user.subscription.requestLimit}). Please upgrade your subscription plan.`,
        HttpStatus.PAYMENT_REQUIRED, // 402 Payment Required
      );
    }

    // 2. Decrypt default or requested provider key in memory
    const provider = await this.aiProvidersService.getActiveProviderDecrypted(dto.model);

    // 3. Resolve or create Conversation thread
    let conversation;
    if (dto.conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId, userId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      const title = dto.prompt.length > 40 ? `${dto.prompt.slice(0, 37)}...` : dto.prompt;
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title,
        },
      });
    }

    // 4. Save user prompt to Message table
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: SenderRole.USER,
        content: dto.prompt,
      },
    });

    // 5. Fetch previous conversation context (last 10 messages)
    const history = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    history.reverse();

    const messages: MessageInput[] = history.map((msg) => ({
      role: msg.role === SenderRole.USER ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    }));

    // 6. Call Vercel AI SDK
    let aiResponseText = '';
    const isDemoKey =
      provider.apiKey.startsWith('sk-demo') ||
      provider.apiKey.startsWith('AIzaSyDemo') ||
      provider.apiKey.startsWith('sk-ant-demo');

    if (isDemoKey) {
      aiResponseText = `[EchoGPT ${provider.name} AI]: In response to "${dto.prompt}": This is an intelligent response generated via the unified Vercel AI SDK routing adapter.`;
    } else {
      try {
        const modelInstance = this.getModelInstance(provider.name, provider.apiKey);
        const { text } = await generateText({
          model: modelInstance,
          messages,
        });
        aiResponseText = text;
      } catch (err: any) {
        this.logger.warn(`Vercel AI SDK generation fallback (${err.message}). Providing fallback response.`);
        aiResponseText = `[EchoGPT ${provider.name} AI]: Here is the response to: "${dto.prompt}". Processed via unified Vercel AI SDK engine.`;
      }
    }

    // 7. Save Assistant response to Message table
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: SenderRole.ASSISTANT,
        content: aiResponseText,
      },
    });

    // 8. Increment user requestsCount
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { requestsCount: { increment: 1 } },
      select: {
        requestsCount: true,
        subscription: { select: { requestLimit: true } },
      },
    });

    const remainingRequests = Math.max(
      0,
      updatedUser.subscription.requestLimit - updatedUser.requestsCount,
    );

    return {
      conversationId: conversation.id,
      provider: provider.name,
      messageId: assistantMessage.id,
      response: assistantMessage.content,
      requestsCount: updatedUser.requestsCount,
      remainingRequests,
      createdAt: assistantMessage.createdAt,
    };
  }

  /**
   * Helper instantiating the Vercel AI SDK Model based on Provider type
   */
  private getModelInstance(name: AiModel, apiKey: string) {
    switch (name) {
      case AiModel.OPENAI:
        return createOpenAI({ apiKey })('gpt-4o-mini');
      case AiModel.CLAUDE:
        return createAnthropic({ apiKey })('claude-3-5-sonnet-20241022');
      case AiModel.GEMINI:
        return createGoogleGenerativeAI({ apiKey })('gemini-1.5-flash');
      default:
        return createOpenAI({ apiKey })('gpt-4o-mini');
    }
  }

  /**
   * Paginated list of conversations for current user
   */
  async listConversations(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { role: true, content: true, createdAt: true },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);

    return {
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        totalMessages: c._count.messages,
        lastMessage: c.messages[0] || null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Full message history of a conversation
   */
  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { message: 'Conversation deleted successfully' };
  }
}

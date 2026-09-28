import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIProvidersService } from '../ai-providers/ai-providers.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessageRole } from '@prisma/client';
import { ChatCompletionMessage } from '../ai-providers/adapters/provider-adapter.interface';
import { Observable } from 'rxjs';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvidersService: AIProvidersService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    const { provider, apiKey, adapter } =
      await this.aiProvidersService.getDecryptedProvider(dto.providerId);

    // Pick model
    const modelsList = Array.isArray(provider.defaultModels)
      ? (provider.defaultModels as string[])
      : [];
    const model = dto.model || modelsList[0] || 'gpt-4o';

    // 1. Resolve or create conversation
    let conversation;
    if (dto.conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId, userId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found or does not belong to user');
      }
    } else {
      const generatedTitle =
        dto.prompt.length > 40 ? `${dto.prompt.slice(0, 37)}...` : dto.prompt;
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: generatedTitle,
          providerId: provider.id,
          modelName: model,
        },
      });
    }

    // 2. Fetch recent conversation history (last 10 messages) for context
    const recentMessages = await this.prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    recentMessages.reverse();

    // 3. Record user's incoming message
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: dto.prompt,
      },
    });

    // 4. Build context payload for AI adapter
    const contextMessages: ChatCompletionMessage[] = [];
    if (dto.systemPrompt) {
      contextMessages.push({ role: 'system', content: dto.systemPrompt });
    }
    for (const msg of recentMessages) {
      contextMessages.push({
        role: msg.role === 'USER' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
    contextMessages.push({ role: 'user', content: dto.prompt });

    // 5. Generate AI response via adapter
    const aiResult = await adapter.generateResponse(
      model,
      contextMessages,
      apiKey,
      provider.baseUrl || undefined,
    );

    // 6. Save assistant response
    const assistantMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: aiResult.text,
        tokensUsed: aiResult.tokensUsed,
        latencyMs: aiResult.latencyMs,
      },
    });

    // Touch conversation updatedAt
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      title: conversation.title,
      provider: {
        id: provider.id,
        displayName: provider.displayName,
        type: provider.providerType,
        model,
      },
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        tokensUsed: assistantMessage.tokensUsed,
        latencyMs: assistantMessage.latencyMs,
        createdAt: assistantMessage.createdAt,
      },
    };
  }

  /**
   * Server-Sent Events (SSE) Streaming response for EchoGPT Chrome Extension
   */
  async streamMessage(userId: string, dto: SendMessageDto): Promise<Observable<MessageEvent>> {
    const { provider, apiKey, adapter } =
      await this.aiProvidersService.getDecryptedProvider(dto.providerId);

    const modelsList = Array.isArray(provider.defaultModels)
      ? (provider.defaultModels as string[])
      : [];
    const model = dto.model || modelsList[0] || 'gpt-4o';

    let conversation;
    if (dto.conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId, userId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      const generatedTitle =
        dto.prompt.length > 40 ? `${dto.prompt.slice(0, 37)}...` : dto.prompt;
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: generatedTitle,
          providerId: provider.id,
          modelName: model,
        },
      });
    }

    // Save user prompt
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: dto.prompt,
      },
    });

    const contextMessages: ChatCompletionMessage[] = [
      ...(dto.systemPrompt ? [{ role: 'system' as const, content: dto.systemPrompt }] : []),
      { role: 'user' as const, content: dto.prompt },
    ];

    const stream = adapter.generateStream(
      model,
      contextMessages,
      apiKey,
      provider.baseUrl || undefined,
    );

    return new Observable((observer) => {
      let accumulatedContent = '';
      const startTime = Date.now();

      (async () => {
        try {
          // Send initial metadata event
          observer.next({
            data: JSON.stringify({
              type: 'start',
              conversationId: conversation.id,
              provider: provider.displayName,
              model,
            }),
          } as MessageEvent);

          for await (const chunk of stream) {
            accumulatedContent += chunk;
            observer.next({
              data: JSON.stringify({
                type: 'delta',
                text: chunk,
              }),
            } as MessageEvent);
          }

          const latencyMs = Date.now() - startTime;
          const tokensUsed = Math.ceil(accumulatedContent.length / 4);

          // Save completed assistant message to database
          const savedMsg = await this.prisma.chatMessage.create({
            data: {
              conversationId: conversation.id,
              role: MessageRole.ASSISTANT,
              content: accumulatedContent,
              tokensUsed,
              latencyMs,
            },
          });

          observer.next({
            data: JSON.stringify({
              type: 'done',
              messageId: savedMsg.id,
              totalTokens: tokensUsed,
              latencyMs,
            }),
          } as MessageEvent);

          observer.complete();
        } catch (err: any) {
          observer.error(err);
        }
      })();
    });
  }

  async listConversations(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId },
        include: {
          provider: {
            select: { displayName: true, providerType: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true, role: true, createdAt: true },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);

    return {
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        modelName: c.modelName,
        provider: c.provider,
        totalMessages: c._count.messages,
        lastMessage: c.messages[0] || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        provider: {
          select: { id: true, displayName: true, providerType: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            tokensUsed: true,
            latencyMs: true,
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

  async createConversation(userId: string, dto: CreateConversationDto) {
    let providerId = dto.providerId;
    let modelName = dto.model || 'gpt-4o';

    if (!providerId) {
      const def = await this.prisma.aIProvider.findFirst({
        where: { isDefault: true, isEnabled: true },
      });
      providerId = def?.id;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        title: dto.title || 'New Conversation',
        providerId,
        modelName,
      },
    });

    return conversation;
  }

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

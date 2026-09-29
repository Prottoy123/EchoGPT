import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIProvidersService } from '../ai-providers/ai-providers.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AiModel, SenderRole } from '@prisma/client';
import { generateText, streamText } from 'ai';
import { Response } from 'express';
import {
  SendMessageZodSchema,
  RawAiTextOutputSchema,
  ChatResponsePayloadSchema,
} from './chat.schema';

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
   * Core Chat Logic with Zod Validation:
   * 0. Validate prompt and request parameters using Zod (min 1, max 4000, trimmed, UUID)
   * 1. Check requestsCount < requestLimit -> Throw 402 if exceeded
   * 2. Decrypt default/target provider key
   * 3. Call Vercel AI SDK
   * 4. Sanitize and validate raw AI response using Zod
   * 5. Save Conversation History
   * 6. Increment requestsCount
   * 7. Enforce runtime response contract via Zod before returning
   */
  async sendMessage(userId: string, dto: SendMessageDto) {
    // 0. Zod Validation for incoming prompt and parameters
    const parsedInput = SendMessageZodSchema.safeParse(dto);
    if (!parsedInput.success) {
      const issues = (parsedInput.error as any).issues || [];
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Prompt validation failed via Zod',
        details: issues.map((issue: any) => ({
          field: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    const validatedDto = parsedInput.data;

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
    const provider = await this.aiProvidersService.getActiveProviderDecrypted(validatedDto.model);

    // 3. Resolve or create Conversation thread
    let conversation;
    if (validatedDto.conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: validatedDto.conversationId, userId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      const title =
        validatedDto.prompt.length > 40
          ? `${validatedDto.prompt.slice(0, 37)}...`
          : validatedDto.prompt;
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
        content: validatedDto.prompt,
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
      aiResponseText = `[EchoGPT ${provider.name} AI]: In response to "${validatedDto.prompt}": This is an intelligent response generated via the unified Vercel AI SDK routing adapter.`;
    } else {
      try {
        const modelInstance = this.getModelInstance(provider.name, provider.apiKey);
        const { text } = await generateText({
          model: modelInstance,
          messages,
        });
        aiResponseText = text;
      } catch (err: any) {
        this.logger.warn(
          `Vercel AI SDK upstream failure for ${provider.name}: ${err.message}`,
        );

        let cleanReason = err.message || 'Unknown upstream error';
        if (cleanReason.includes('no credits remaining') || cleanReason.includes('insufficient_quota')) {
          cleanReason =
            'Your OpenAI account currently has $0.00 billing credits. OpenAI requires a funded account ($5 minimum at platform.openai.com/settings/organization/billing) to generate live completions.';
        } else if (cleanReason.includes('API key not valid') || cleanReason.includes('API_KEY_INVALID')) {
          cleanReason =
            `The API key configured for ${provider.name} is invalid or expired. For a 100% free key, generate one at https://aistudio.google.com/app/apikey.`;
        }

        aiResponseText = `[EchoGPT ${provider.name} Provider Notice]: ${cleanReason}`;
      }
    }

    // 7. Validate and sanitize raw AI model text output with Zod
    const validatedAiOutput = RawAiTextOutputSchema.safeParse(aiResponseText);
    const sanitizedAiText = validatedAiOutput.success
      ? validatedAiOutput.data
      : `[EchoGPT ${provider.name} AI]: The AI model did not return valid textual content. Please rephrase your query.`;

    // 8. Save Assistant response to Message table
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: SenderRole.ASSISTANT,
        content: sanitizedAiText,
      },
    });

    // 9. Increment user requestsCount
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

    // 10. Enforce runtime response contract validation using Zod
    const rawResponse = {
      conversationId: conversation.id,
      provider: provider.name,
      messageId: assistantMessage.id,
      response: assistantMessage.content,
      requestsCount: updatedUser.requestsCount,
      remainingRequests,
      createdAt: assistantMessage.createdAt,
    };

    return ChatResponsePayloadSchema.parse(rawResponse);
  }

  /**
   * Streaming Response (Bonus): Stream tokens via Server-Sent Events (SSE)
   */
  async streamMessage(userId: string, dto: SendMessageDto, res: Response) {
    const parsedInput = SendMessageZodSchema.safeParse(dto);
    if (!parsedInput.success) {
      const issues = (parsedInput.error as any).issues || [];
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Prompt validation failed via Zod',
        details: issues.map((issue: any) => ({
          field: Array.isArray(issue.path) ? issue.path.join('.') : String(issue.path || ''),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    const validatedDto = parsedInput.data;

    // 1. Quota check
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
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 2. Decrypt provider key
    const provider = await this.aiProvidersService.getActiveProviderDecrypted(validatedDto.model);

    // 3. Conversation resolve
    let conversation;
    if (validatedDto.conversationId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: validatedDto.conversationId, userId },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
    } else {
      const title =
        validatedDto.prompt.length > 40
          ? `${validatedDto.prompt.slice(0, 37)}...`
          : validatedDto.prompt;
      conversation = await this.prisma.conversation.create({
        data: { userId, title },
      });
    }

    // 4. Save user message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: SenderRole.USER,
        content: validatedDto.prompt,
      },
    });

    // 5. Context window
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

    // 6. Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let fullResponse = '';
    const isDemoKey =
      provider.apiKey.startsWith('sk-demo') ||
      provider.apiKey.startsWith('AIzaSyDemo') ||
      provider.apiKey.startsWith('sk-ant-demo');

    if (isDemoKey) {
      const demoChunks = [
        `[EchoGPT `,
        `${provider.name} `,
        `Streaming AI]: `,
        `Real-time `,
        `stream `,
        `response `,
        `for: `,
        `"${validatedDto.prompt}". `,
        `Delivered via Server-Sent Events (SSE).`,
      ];
      for (const chunk of demoChunks) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }
    } else {
      try {
        const modelInstance = this.getModelInstance(provider.name, provider.apiKey);
        const result = streamText({
          model: modelInstance,
          messages,
          onError: ({ error }) => {
            this.logger.warn(`Vercel AI SDK streamText onError: ${error}`);
          },
        });

        try {
          for await (const delta of result.textStream) {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
          }
        } catch (streamErr: any) {
          this.logger.warn(`Stream iteration error: ${streamErr.message}`);
          const fallbackText = `[EchoGPT ${provider.name} Notice]: ${streamErr.message}`;
          fullResponse += fallbackText;
          res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
        }
      } catch (err: any) {
        this.logger.warn(`Streaming upstream failure for ${provider.name}: ${err.message}`);
        const fallbackText = `[EchoGPT ${provider.name} Provider Notice]: ${err.message}`;
        fullResponse += fallbackText;
        res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      }
    }

    // 7. Save Assistant Message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: SenderRole.ASSISTANT,
        content: fullResponse || 'Stream finished',
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

    // Send closing SSE message
    res.write(
      `data: ${JSON.stringify({
        done: true,
        conversationId: conversation.id,
        requestsCount: updatedUser.requestsCount,
        remainingRequests,
      })}\n\n`,
    );
    res.end();
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
        return createGoogleGenerativeAI({ apiKey })('gemini-3-flash-preview');
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

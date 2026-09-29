import { z } from 'zod';
import { AiModel } from '@prisma/client';

/**
 * Zod Schema for incoming Chat Prompt & Request Parameters
 */
export const SendMessageZodSchema = z.object({
  prompt: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: 'Prompt cannot be empty or consist solely of whitespace',
    })
    .refine((val) => val.length <= 4000, {
      message: 'Prompt exceeds maximum permissible length of 4,000 characters',
    }),

  conversationId: z.uuid({ message: 'conversationId must be a valid UUID v4' }).optional(),

  model: z.enum(AiModel).optional(),

  systemPrompt: z
    .string()
    .max(1000, { message: 'System prompt cannot exceed 1,000 characters' })
    .optional(),

  temperature: z
    .number()
    .min(0, { message: 'Temperature must be between 0.0 and 2.0' })
    .max(2, { message: 'Temperature must be between 0.0 and 2.0' })
    .optional(),

  maxTokens: z
    .number()
    .int()
    .min(1, { message: 'maxTokens must be at least 1' })
    .max(8192, { message: 'maxTokens cannot exceed 8,192' })
    .optional(),
});

export type SendMessageZodInput = z.infer<typeof SendMessageZodSchema>;

/**
 * Zod Schema to validate and sanitize raw AI model text output
 */
export const RawAiTextOutputSchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => val.length > 0, {
    message: 'Model output was empty or invalid',
  });

/**
 * Zod Schema for the complete Chat API Response payload
 * Guarantees runtime response contract compliance before delivery to client
 */
export const ChatResponsePayloadSchema = z.object({
  conversationId: z.uuid(),
  provider: z.enum(AiModel),
  messageId: z.uuid(),
  response: z.string().min(1, 'Response text cannot be empty'),
  requestsCount: z.number().int().nonnegative(),
  remainingRequests: z.number().int().nonnegative(),
  createdAt: z.union([z.date(), z.string()]),
});

export type ChatResponsePayload = z.infer<typeof ChatResponsePayloadSchema>;

/**
 * Structured Output Schema for advanced AI extraction / reasoning tasks
 */
export const StructuredAiReasoningSchema = z.object({
  summary: z.string().describe('Concise 1-2 sentence executive summary of the response'),
  mainPoints: z.array(z.string()).describe('Key takeaways or bullet points'),
  answer: z.string().describe('Full comprehensive answer'),
  suggestedFollowUps: z
    .array(z.string())
    .max(3)
    .optional()
    .describe('Up to 3 relevant follow-up questions the user might ask'),
});

export type StructuredAiReasoning = z.infer<typeof StructuredAiReasoningSchema>;

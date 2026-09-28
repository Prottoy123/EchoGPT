import { IsNotEmpty, IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { AiModel } from '@prisma/client';

export class SendMessageDto {
  /**
   * The user query or message prompt
   * @example Explain quantum computing in 2 sentences.
   */
  @IsString()
  @IsNotEmpty({ message: 'Prompt cannot be empty' })
  prompt: string;

  /**
   * Optional Conversation UUID (auto-creates a new thread if omitted)
   * @example 3fa85f64-5717-4562-b3fc-2c963f66afa6
   */
  @IsOptional()
  @IsUUID('4', { message: 'conversationId must be a valid UUID' })
  conversationId?: string;

  /**
   * Optional target AI provider (defaults to global default provider)
   * @example OPENAI
   */
  @IsOptional()
  @IsEnum(AiModel, { message: 'Model must be OPENAI, CLAUDE, or GEMINI' })
  model?: AiModel;
}

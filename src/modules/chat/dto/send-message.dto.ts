import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  /**
   * User prompt or query
   * @example Explain the theory of relativity in simple terms
   */
  @IsString()
  @IsNotEmpty({ message: 'Prompt cannot be empty' })
  prompt: string;

  /**
   * Conversation UUID (Optional: auto-creates new thread if omitted)
   * @example 3fa85f64-5717-4562-b3fc-2c963f66afa6
   */
  @IsOptional()
  @IsUUID('4', { message: 'conversationId must be a valid UUID' })
  conversationId?: string;

  /**
   * AI Provider UUID (Optional: uses system default provider if omitted)
   * @example 3fa85f64-5717-4562-b3fc-2c963f66afa6
   */
  @IsOptional()
  @IsUUID('4', { message: 'providerId must be a valid UUID' })
  providerId?: string;

  /**
   * Specific AI Model name (e.g. gpt-4o, claude-3-5-sonnet, gemini-1.5-pro)
   * @example gpt-4o
   */
  @IsOptional()
  @IsString()
  model?: string;

  /**
   * Optional custom system instructions
   * @example You are an expert scientific researcher.
   */
  @IsOptional()
  @IsString()
  systemPrompt?: string;
}

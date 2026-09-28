import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';
import { AiModel } from '@prisma/client';

export class CreateProviderDto {
  /**
   * AI Provider Platform model name
   * @example OPENAI
   */
  @IsEnum(AiModel, { message: 'Provider name must be OPENAI, CLAUDE, or GEMINI' })
  @IsNotEmpty()
  name: AiModel;

  /**
   * Plain text API key (will be encrypted using AES-256-GCM before DB persistence)
   * @example sk-proj-1234567890abcdef
   */
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  /**
   * Whether this provider is enabled
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Set as global default provider
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

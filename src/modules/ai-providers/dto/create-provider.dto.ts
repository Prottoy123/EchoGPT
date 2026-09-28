import { IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';
import { AIProviderType } from '@prisma/client';

export class CreateProviderDto {
  /**
   * AI Provider Platform
   * @example OPENAI
   */
  @IsEnum(AIProviderType, { message: 'Provider type must be OPENAI, ANTHROPIC, or GEMINI' })
  @IsNotEmpty()
  providerType: AIProviderType;

  /**
   * Display name for the provider in the extension
   * @example OpenAI (Production)
   */
  @IsString()
  @IsNotEmpty()
  displayName: string;

  /**
   * Raw API Key (will be encrypted using AES-256-GCM before database storage)
   * @example sk-proj-1234567890abcdef
   */
  @IsString()
  @IsNotEmpty()
  apiKey: string;

  /**
   * Optional custom Base URL
   * @example https://api.openai.com/v1
   */
  @IsOptional()
  @IsString()
  baseUrl?: string;

  /**
   * Supported model list
   * @example ["gpt-4o", "gpt-4o-mini"]
   */
  @IsOptional()
  @IsArray()
  defaultModels?: string[];

  /**
   * Whether this should be the default AI provider
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

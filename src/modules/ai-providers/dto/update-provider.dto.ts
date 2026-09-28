import { IsOptional, IsString, IsArray, IsBoolean } from 'class-validator';

export class UpdateProviderDto {
  /**
   * Updated display name
   * @example OpenAI GPT-4o Enhanced
   */
  @IsOptional()
  @IsString()
  displayName?: string;

  /**
   * New API Key (will replace existing key and be re-encrypted)
   * @example sk-proj-new-api-key-here
   */
  @IsOptional()
  @IsString()
  apiKey?: string;

  /**
   * Updated Base URL
   * @example https://api.openai.com/v1
   */
  @IsOptional()
  @IsString()
  baseUrl?: string;

  /**
   * Updated model list
   * @example ["gpt-4o", "gpt-4o-mini", "o1-preview"]
   */
  @IsOptional()
  @IsArray()
  defaultModels?: string[];

  /**
   * Enable or disable provider
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  /**
   * Set as system default provider
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
  /**
   * Title of the conversation
   * @example Project Research
   */
  @IsOptional()
  @IsString()
  title?: string;

  /**
   * Provider ID
   * @example 3fa85f64-5717-4562-b3fc-2c963f66afa6
   */
  @IsOptional()
  @IsUUID('4')
  providerId?: string;

  /**
   * Default model for this conversation
   * @example gpt-4o
   */
  @IsOptional()
  @IsString()
  model?: string;
}

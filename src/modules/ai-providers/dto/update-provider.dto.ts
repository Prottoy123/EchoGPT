import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateProviderDto {
  /**
   * New API key to re-encrypt and store
   * @example sk-proj-new-secret-key
   */
  @IsOptional()
  @IsString()
  apiKey?: string;

  /**
   * Active state toggle
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Default provider flag
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

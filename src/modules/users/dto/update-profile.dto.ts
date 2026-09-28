import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  /**
   * User display name
   * @example John Doe
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

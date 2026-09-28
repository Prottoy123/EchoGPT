import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  /**
   * Updated first name
   * @example Jane
   */
  @IsOptional()
  @IsString()
  firstName?: string;

  /**
   * Updated last name
   * @example Smith
   */
  @IsOptional()
  @IsString()
  lastName?: string;
}

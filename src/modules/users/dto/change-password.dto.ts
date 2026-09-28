import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /**
   * Current account password
   * @example OldSecret123!
   */
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  /**
   * New account password (min 6 characters)
   * @example NewSecret456!
   */
  @IsString()
  @MinLength(6)
  newPassword: string;
}

import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  /**
   * Current account password
   * @example CurrentSecret123!
   */
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  /**
   * New password (minimum 8 characters)
   * @example BrandNewSecret456!
   */
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  newPassword: string;
}

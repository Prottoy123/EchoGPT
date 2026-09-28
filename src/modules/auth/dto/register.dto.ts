import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  /**
   * User email address
   * @example user@echogpt.com
   */
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email: string;

  /**
   * Account password (min 8 characters)
   * @example SecretPass123!
   */
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  /**
   * First name of the user
   * @example John
   */
  @IsOptional()
  @IsString()
  firstName?: string;

  /**
   * Last name of the user
   * @example Doe
   */
  @IsOptional()
  @IsString()
  lastName?: string;
}

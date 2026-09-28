import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  /**
   * User email address
   * @example user@echogpt.com
   */
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * Account password (min 6 characters)
   * @example Secret123!
   */
  @IsString()
  @MinLength(6)
  password: string;
}

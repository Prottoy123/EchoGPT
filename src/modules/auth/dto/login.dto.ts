import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /**
   * Registered email address
   * @example user@echogpt.com
   */
  @IsEmail()
  @IsNotEmpty()
  email: string;

  /**
   * Account password
   * @example Secret123!
   */
  @IsString()
  @IsNotEmpty()
  password: string;
}

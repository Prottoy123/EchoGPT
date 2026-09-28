import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  /**
   * Registered email address
   * @example user@echogpt.com
   */
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty()
  email: string;

  /**
   * Account password
   * @example SecretPass123!
   */
  @IsString()
  @IsNotEmpty()
  password: string;
}

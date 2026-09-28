import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  /**
   * Verification token sent to user's email
   * @example 4a3e7b1c-9f8d-4e2a-b6c8-1a2b3c4d5e6f
   */
  @IsString()
  @IsNotEmpty()
  token: string;
}

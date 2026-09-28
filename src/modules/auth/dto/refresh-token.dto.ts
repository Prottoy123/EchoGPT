import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  /**
   * Refresh token issued during login
   * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   */
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

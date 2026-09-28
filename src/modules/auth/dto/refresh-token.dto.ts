import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  /**
   * Refresh token
   * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   */
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

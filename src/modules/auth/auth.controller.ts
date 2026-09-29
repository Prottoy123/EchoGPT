import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user account (auto-assigned FREE plan)',
    description: `
### ⚙️ How It Occurs in the Service
1. **Input Validation**: Evaluates RFC-compliant email formatting and minimum password length constraints via class-validator.
2. **Duplication Guard**: Performs an indexed search on \`User.email\`; aborts with HTTP 409 Conflict if an account already exists.
3. **Argon2id Hashing**: Hashes raw passwords using Argon2id (memory-hard, resistant to GPU/ASIC attacks).
4. **Subscription Linkage**: Queries the \`Subscription\` table for \`PlanType.FREE\` (creating it if absent) and attaches the user record with an initial \`requestsCount: 0\`.
5. **Dual-Token Generation**: Issues an access token (15m expiry) and refresh token (7d expiry), saving the Argon2-hashed refresh token to \`User.hashedRefreshToken\`.

### 📈 Future Scalability & Architecture Roadmap
* **Async Verification**: Offload welcome and email verification emails to background BullMQ worker queues.
* **Captcha Guard**: Introduce Turnstile / reCAPTCHA validation on the edge to prevent credential stuffing bots.
    `,
  })
  @ApiResponse({ status: 201, description: 'User successfully registered with dual JWT tokens' })
  @ApiResponse({ status: 409, description: 'Email already registered in system' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in and receive JWT Access & Refresh tokens',
    description: `
### ⚙️ How It Occurs in the Service
1. **Record Lookup**: Retrieves user by normalized email including role and subscription relations.
2. **Constant-Time Verification**: Verifies submitted password against stored Argon2id hash.
3. **Token Issuance**: Generates a 15-minute asymmetric JWT access token and a 7-day cryptographic refresh token.
4. **Session Persistence**: Hashes the refresh token and persists it in PostgreSQL, ensuring only the single latest issued token can rotate the session.

### 📈 Future Scalability & Architecture Roadmap
* **Distributed Brute-Force Shield**: Transition from in-memory throttler to distributed Redis rate-limiting per IP/email.
* **Geo-Fencing & Anomaly Alerts**: Emit login events via Kafka or RabbitMQ for fraud analysis.
    `,
  })
  @ApiResponse({ status: 200, description: 'User authenticated; Access and Refresh tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid email or password credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue new access token',
    description: `
### ⚙️ How It Occurs in the Service
1. **Cryptographic Verification**: Verifies incoming refresh token signature using \`JWT_REFRESH_SECRET\`.
2. **Database Hash Comparison**: Matches token against \`User.hashedRefreshToken\` using Argon2 verification.
3. **Replay Protection**: Immediately generates and hashes a brand new refresh token, invalidating the old token upon use.
4. **Dual Return**: Emits refreshed access token (15m) and rotated refresh token (7d).

### 📈 Future Scalability & Architecture Roadmap
* **Multi-Device Session Cluster**: Migrate session tokens to Redis with family IDs to track and selectively revoke individual laptop/mobile extension sessions.
    `,
  })
  @ApiResponse({ status: 200, description: 'Tokens rotated; new access and refresh tokens returned' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid, revoked, or expired' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log out user and invalidate refresh token session',
    description: `
### ⚙️ How It Occurs in the Service
1. **Identity Extraction**: Extracts verified user ID from active JWT bearer payload.
2. **Session Revocation**: Updates \`User.hashedRefreshToken\` to \`null\` in PostgreSQL.
3. **Rejection Safeguard**: Any subsequent attempts to call \`/auth/refresh\` are permanently rejected with HTTP 401 Unauthorized.

### 📈 Future Scalability & Architecture Roadmap
* **JWT Blocklist**: Publish active access token JTI to a short-lived Redis TTL blocklist for immediate distributed token revocation across all microservices.
    `,
  })
  @ApiResponse({ status: 200, description: 'User session successfully terminated' })
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Post('send-verification')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email Verification (Bonus): Dispatch email verification token link',
    description: `
### Email Verification Flow
- Generates a signed cryptographic verification JWT valid for 24 hours.
- Saves the token in PostgreSQL and dispatches verification link.
    `,
  })
  @ApiResponse({ status: 200, description: 'Verification email dispatched' })
  async sendVerificationEmail(@CurrentUser('id') userId: string) {
    return this.authService.sendVerificationEmail(userId);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email Verification (Bonus): Verify email address via cryptographic token',
    description: `
### Email Confirmation
- Verifies the signature and expiration of the verification token.
- Updates \`User.isEmailVerified\` to \`true\` in PostgreSQL.
    `,
  })
  @ApiResponse({ status: 200, description: 'Email address verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification token' })
  async verifyEmail(
    @Body('token') bodyToken?: string,
    @Query('token') queryToken?: string,
  ) {
    const token = bodyToken || queryToken;
    return this.authService.verifyEmail(token as string);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Email Verification (Bonus): Verify email via GET link from inbox' })
  @ApiResponse({ status: 200, description: 'Email address verified successfully' })
  async verifyEmailGet(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }
}

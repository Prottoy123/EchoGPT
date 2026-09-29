import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('User Profile & Usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile and remaining request quota',
    description: `
### ⚙️ How It Occurs in the Service
1. **Identity Resolution**: Injects authenticated \`userId\` from verified JWT context.
2. **Relational Query**: Fetches the user entity joined with active \`Subscription\` plan.
3. **Dynamic Quota Calculation**: Evaluates \`remainingRequests = Math.max(0, requestLimit - requestsCount)\` in real time.
4. **Data Sanitization**: Excludes sensitive password hashes and internal token hashes before returning payload.

### 📈 Future Scalability & Architecture Roadmap
* **Read-Replica Routing**: Offload read-heavy profile checks from Primary PostgreSQL to read replicas.
* **Cached Session Snapshot**: Cache user plan & quota in Redis with a 60-second TTL to reduce database query volume.
    `,
  })
  @ApiResponse({ status: 200, description: 'Profile and usage tracking returned' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user profile (display name)',
    description: `
### ⚙️ How It Occurs in the Service
1. **Payload Sanitization**: Validates display name length and characters.
2. **Selective Mutation**: Updates \`User.name\` in PostgreSQL without touching email or auth secrets.
3. **Safe Projection**: Emits updated user model excluding auth tokens.

### 📈 Future Scalability & Architecture Roadmap
* **Object Storage**: Add presigned S3 / Cloudflare R2 URL generation for profile avatars and extension preferences.
    `,
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto.name);
  }

  @Get('me/subscription')
  @ApiOperation({
    summary: 'Get subscription status and remaining request quota',
    description: `
### ⚙️ How It Occurs in the Service
1. **Tier Inspection**: Queries active \`Subscription\` entity (\`FREE\` vs \`PREMIUM\`).
2. **Quota Metrics**: Returns total limit, consumed count, remaining balance, and active status flag.

### 📈 Future Scalability & Architecture Roadmap
* **Billing Gateway Webhooks**: Integrate Stripe / LemonSqueezy webhooks for real-time plan status synchronization.
    `,
  })
  @ApiResponse({ status: 200, description: 'Subscription status and usage limit returned' })
  async getSubscriptionStatus(@CurrentUser('id') userId: string) {
    return this.usersService.getSubscriptionStatus(userId);
  }

  @Get('me/remaining-requests')
  @ApiOperation({
    summary: 'Remaining Requests API: Get remaining quota count and consumption metrics',
    description: `
### ⚙️ How It Occurs in the Service
1. **Real-time Quota Calculation**: Evaluates \`Math.max(0, requestLimit - requestsCount)\`.
2. **Threshold Monitoring**: Computes \`isLimitReached\` boolean flag so frontend/extension can display upgrade triggers.
    `,
  })
  @ApiResponse({ status: 200, description: 'Remaining requests count and quota status returned' })
  async getRemainingRequests(@CurrentUser('id') userId: string) {
    return this.usersService.getRemainingRequests(userId);
  }

  @Post('me/downgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Downgrade account to FREE plan (50 requests limit)',
    description: `
### ⚙️ How It Occurs in the Service
1. **Tier Reversion**: Resolves \`FREE\` subscription plan ID and updates \`User.subscriptionId\`.
2. **Preserves Consumption**: Retains current \`requestsCount\` to prevent abuse across downgrade/upgrade cycles.
    `,
  })
  @ApiResponse({ status: 200, description: 'Downgraded to FREE successfully' })
  async downgradePlan(@CurrentUser('id') userId: string) {
    return this.usersService.downgradePlan(userId);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change account password and revoke existing sessions',
    description: `
### ⚙️ How It Occurs in the Service
1. **Current Password Check**: Uses Argon2id constant-time comparison to verify current password.
2. **Re-Hashing**: Hashes new password with Argon2id using fresh salt.
3. **Session Invalidation**: Clears \`hashedRefreshToken\` in PostgreSQL, forcing all other active devices/extensions to re-authenticate.

### 📈 Future Scalability & Architecture Roadmap
* **Security Notifications**: Dispatch email alert notification regarding password changes via worker queue.
    `,
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully; sessions invalidated' })
  @ApiResponse({ status: 400, description: 'Current password does not match' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  @Post('me/upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade account to PREMIUM plan (1,000 requests quota)',
    description: `
### ⚙️ How It Occurs in the Service
1. **Plan Resolution**: Locates or provisions \`PlanType.PREMIUM\` (1,000 request limit).
2. **Relational Linkage**: Mutates \`User.subscriptionId\` in PostgreSQL.
3. **Quota Expansion**: Immediately grants access to up to 1,000 requests per month.
    `,
  })
  @ApiResponse({ status: 200, description: 'Upgraded to PREMIUM successfully' })
  async upgradePlan(@CurrentUser('id') userId: string) {
    return this.usersService.upgradePlan(userId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete user account and all associated data',
    description: `
### ⚙️ How It Occurs in the Service
1. **Identity Assertion**: Validates current user existence.
2. **Cascade Deletion**: Database foreign key constraints cascade-delete all child conversations, messages, sessions, and web search logs.
3. **GDPR Compliance**: Permanently purges user record from PostgreSQL.
    `,
  })
  @ApiResponse({ status: 200, description: 'Account permanently deleted' })
  async deleteAccount(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}

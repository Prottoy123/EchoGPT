import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Subscription Management')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({
    summary: 'List available plans (Free & Premium)',
    description: `
### Plan Catalog & Feature Matrix
- Returns all supported subscription tiers:
  - **FREE**: 50 AI requests/month, Google Gemini & OpenAI access, web search integration.
  - **PREMIUM**: 1,000 AI requests/month, Claude 3.5 Sonnet, low-latency priority inference routing, extended context window.
    `,
  })
  @ApiResponse({ status: 200, description: 'Available plans and feature matrices returned' })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOperation({
    summary: 'Subscription Status API: Get current user subscription tier and status',
    description: `
### Subscription Status & Metrics
- **Identity Context**: Resolves authenticated user from JWT.
- **Relational Plan Inspection**: Queries active \`Subscription\` entity (\`FREE\` vs \`PREMIUM\`).
- **Real-Time Quota Metrics**: Returns total limit, consumed count, remaining requests balance, and active status flag.
    `,
  })
  @ApiResponse({ status: 200, description: 'Active subscription status returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid Bearer JWT' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getStatus(userId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('remaining-requests')
  @ApiOperation({
    summary: 'Remaining Requests API: Get remaining quota count and consumption metrics',
    description: `
### Usage Limits & Balance Checking
- **Real-time Quota Calculation**: Evaluates \`Math.max(0, requestLimit - requestsCount)\`.
- **Threshold Monitoring**: Computes \`isLimitReached\` boolean flag so client/extension can trigger upgrade modals.
    `,
  })
  @ApiResponse({ status: 200, description: 'Remaining requests count and quota status returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid Bearer JWT' })
  async getRemainingRequests(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getRemainingRequests(userId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upgrade Subscription: Upgrade account to PREMIUM plan (1,000 requests quota)',
    description: `
### Quota Expansion & Tier Elevation
- **Plan Mutation**: Transitions user account from \`FREE\` to \`PREMIUM\` tier.
- **Immediate Quota Expansion**: Expands monthly quota from 50 to 1,000 requests.
- **Preserves Consumption**: Retains current \`requestsCount\` to ensure billing integrity.
    `,
  })
  @ApiResponse({ status: 200, description: 'Upgraded to PREMIUM successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid Bearer JWT' })
  async upgrade(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.upgrade(userId);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Downgrade Subscription: Downgrade account to FREE plan (50 requests limit)',
    description: `
### Tier Reversion
- **Plan Mutation**: Transitions user account to \`FREE\` tier.
- **Quota Contraction**: Restricts monthly request quota to 50 requests.
    `,
  })
  @ApiResponse({ status: 200, description: 'Downgraded to FREE successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid Bearer JWT' })
  async downgrade(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.downgrade(userId);
  }
}

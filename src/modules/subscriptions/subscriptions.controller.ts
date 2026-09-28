import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Subscription Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get current subscription tier, features, and available plans' })
  @ApiResponse({ status: 200, description: 'Subscription status details returned' })
  async getStatus(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getStatus(userId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get usage limits and remaining requests/tokens for the current billing cycle' })
  @ApiResponse({ status: 200, description: 'Usage and quota telemetry returned' })
  async getUsage(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getUsage(userId);
  }

  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade user subscription plan' })
  @ApiResponse({ status: 200, description: 'Plan upgraded successfully' })
  @ApiResponse({ status: 400, description: 'User already on selected plan' })
  async upgrade(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionsService.upgrade(userId, dto);
  }

  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Downgrade user subscription plan' })
  @ApiResponse({ status: 200, description: 'Plan downgraded successfully' })
  async downgrade(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.subscriptionsService.downgrade(userId, dto);
  }
}

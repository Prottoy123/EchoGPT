import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { PlanTier, SubscriptionStatus } from '@prisma/client';

export const PLAN_CONFIGS = {
  [PlanTier.FREE]: {
    name: 'Free Starter',
    monthlyRequestLimit: 50,
    monthlyTokenLimit: 100000,
    priceMonthly: 0,
    features: ['50 Requests / Month', 'Standard Latency', 'GPT-3.5 / Gemini Flash', 'Basic Search'],
  },
  [PlanTier.PREMIUM]: {
    name: 'EchoGPT Pro',
    monthlyRequestLimit: 1000,
    monthlyTokenLimit: 2000000,
    priceMonthly: 19.99,
    features: ['1,000 Requests / Month', 'GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro', 'Real-Time SSE Streaming', 'Web Search Caching'],
  },
  [PlanTier.ENTERPRISE]: {
    name: 'Enterprise Ultra',
    monthlyRequestLimit: 10000,
    monthlyTokenLimit: 20000000,
    priceMonthly: 99.99,
    features: ['10,000 Requests / Month', 'Highest Priority & Throughput', 'Custom Provider Endpoints', 'Dedicated SLA'],
  },
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found');
    }

    return {
      currentSubscription: subscription,
      planDetails: PLAN_CONFIGS[subscription.plan],
      availablePlans: PLAN_CONFIGS,
    };
  }

  async getUsage(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription record not found');
    }

    // Aggregate user messages in current billing cycle
    const userMessages = await this.prisma.chatMessage.findMany({
      where: {
        role: 'USER',
        conversation: { userId },
        createdAt: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
      select: {
        tokensUsed: true,
      },
    });

    const usedRequests = userMessages.length;
    const usedTokens = userMessages.reduce((sum, msg) => sum + (msg.tokensUsed || 0), 0);

    const totalRequestsAllowed = subscription.monthlyRequestLimit;
    const remainingRequests = Math.max(0, totalRequestsAllowed - usedRequests);

    const totalTokensAllowed = subscription.monthlyTokenLimit;
    const remainingTokens = Math.max(0, totalTokensAllowed - usedTokens);

    const percentRequestsUsed = Math.min(100, Math.round((usedRequests / totalRequestsAllowed) * 100));

    return {
      plan: subscription.plan,
      status: subscription.status,
      billingCycle: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      },
      requests: {
        limit: totalRequestsAllowed,
        used: usedRequests,
        remaining: remainingRequests,
        percentUsed: percentRequestsUsed,
      },
      tokens: {
        limit: totalTokensAllowed,
        used: usedTokens,
        remaining: remainingTokens,
      },
    };
  }

  async upgrade(userId: string, dto: ChangePlanDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.plan === dto.plan) {
      throw new BadRequestException(`User is already on the ${dto.plan} plan`);
    }

    const config = PLAN_CONFIGS[dto.plan];
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(now.getDate() + 30);

    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        plan: dto.plan,
        status: SubscriptionStatus.ACTIVE,
        monthlyRequestLimit: config.monthlyRequestLimit,
        monthlyTokenLimit: config.monthlyTokenLimit,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    return {
      message: `Successfully upgraded to ${config.name}!`,
      subscription: updated,
    };
  }

  async downgrade(userId: string, dto: ChangePlanDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const config = PLAN_CONFIGS[dto.plan];

    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: {
        plan: dto.plan,
        monthlyRequestLimit: config.monthlyRequestLimit,
        monthlyTokenLimit: config.monthlyTokenLimit,
      },
    });

    return {
      message: `Successfully downgraded to ${config.name}.`,
      subscription: updated,
    };
  }
}

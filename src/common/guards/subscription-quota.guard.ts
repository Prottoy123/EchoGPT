import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionQuotaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true; // Delegate to JwtAuthGuard
    }

    // Admins have unrestricted access
    if (user.role === Role.ADMIN) {
      return true;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      throw new ForbiddenException('No active subscription found. Please subscribe to continue.');
    }

    // Count messages sent in current period
    const currentPeriodUsage = await this.prisma.chatMessage.count({
      where: {
        role: 'USER',
        conversation: {
          userId: user.id,
        },
        createdAt: {
          gte: subscription.currentPeriodStart,
          lte: subscription.currentPeriodEnd,
        },
      },
    });

    if (currentPeriodUsage >= subscription.monthlyRequestLimit) {
      throw new ForbiddenException(
        `Monthly request limit reached (${currentPeriodUsage}/${subscription.monthlyRequestLimit}). Please upgrade your subscription.`,
      );
    }

    return true;
  }
}

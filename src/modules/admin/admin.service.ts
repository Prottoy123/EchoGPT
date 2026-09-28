import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalConversations,
      totalMessages,
      totalSearches,
      cachedSearches,
      subscriptionsByPlan,
      totalApiLogs,
      recentErrorsCount,
      providers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.chatMessage.count(),
      this.prisma.webSearch.count(),
      this.prisma.webSearch.count({ where: { isCached: true } }),
      this.prisma.subscription.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
      this.prisma.apiUsageLog.count(),
      this.prisma.apiUsageLog.count({ where: { statusCode: { gte: 400 } } }),
      this.prisma.aIProvider.findMany({
        select: {
          id: true,
          displayName: true,
          providerType: true,
          isEnabled: true,
          isDefault: true,
          healthStatus: true,
          lastHealthCheck: true,
        },
      }),
    ]);

    // Calculate latency metrics from recent 500 logs
    const recentLogs = await this.prisma.apiUsageLog.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
      select: { durationMs: true },
    });

    const averageLatencyMs =
      recentLogs.length > 0
        ? Math.round(
            recentLogs.reduce((sum, l) => sum + l.durationMs, 0) / recentLogs.length,
          )
        : 0;

    const errorRatePercent =
      totalApiLogs > 0
        ? parseFloat(((recentErrorsCount / totalApiLogs) * 100).toFixed(2))
        : 0;

    const cacheHitRatioPercent =
      totalSearches > 0
        ? parseFloat(((cachedSearches / totalSearches) * 100).toFixed(2))
        : 0;

    return {
      users: {
        total: totalUsers,
      },
      subscriptions: subscriptionsByPlan.reduce((acc, curr) => {
        acc[curr.plan] = curr._count.plan;
        return acc;
      }, {} as Record<string, number>),
      activity: {
        totalConversations,
        totalMessages,
        totalSearches,
        cachedSearches,
        cacheHitRatioPercent,
      },
      performance: {
        totalRequestsLogged: totalApiLogs,
        recentErrorsCount,
        errorRatePercent,
        averageLatencyMs,
      },
      providers,
      timestamp: new Date(),
    };
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
          subscription: {
            select: {
              plan: true,
              status: true,
              monthlyRequestLimit: true,
            },
          },
          _count: {
            select: {
              conversations: true,
              webSearches: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    return {
      message: `User role successfully updated to ${role}`,
      user: updated,
    };
  }

  async getApiUsageLogs(page = 1, limit = 50, endpoint?: string, statusCode?: number) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (endpoint) {
      where.endpoint = { contains: endpoint, mode: 'insensitive' };
    }
    if (statusCode) {
      where.statusCode = statusCode;
    }

    const [logs, total] = await Promise.all([
      this.prisma.apiUsageLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.apiUsageLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserSubscriptions(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subscription.count(),
    ]);

    return {
      subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

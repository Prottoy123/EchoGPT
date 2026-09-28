import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, PlanType } from '@prisma/client';
import * as os from 'os';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Dashboard Statistics
   */
  async getDashboardStats() {
    const [
      totalUsers,
      totalConversations,
      totalMessages,
      totalWebSearches,
      providers,
      freeUsers,
      premiumUsers,
      totalLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
      this.prisma.webSearch.count(),
      this.prisma.provider.findMany({
        select: { name: true, isActive: true, isDefault: true },
      }),
      this.prisma.user.count({
        where: { subscription: { planName: PlanType.FREE } },
      }),
      this.prisma.user.count({
        where: { subscription: { planName: PlanType.PREMIUM } },
      }),
      this.prisma.apiUsageLog.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        freePlan: freeUsers,
        premiumPlan: premiumUsers,
      },
      activity: {
        totalConversations,
        totalMessages,
        totalWebSearches,
        totalApiRequests: totalLogs,
      },
      providers: {
        count: providers.length,
        active: providers.filter((p) => p.isActive).length,
        list: providers,
      },
    };
  }

  /**
   * 2. User Management: List Users (Paginated)
   */
  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          requestsCount: true,
          createdAt: true,
          subscription: {
            select: {
              planName: true,
              requestLimit: true,
            },
          },
          _count: {
            select: {
              conversations: true,
              webSearches: true,
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 2. User Management: Change Role
   */
  async updateUserRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    return { message: `User role updated to ${role}`, user: updated };
  }

  /**
   * 2. User Management: Delete User
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }

  /**
   * 3. Subscription Management: List Plans & Subscriber Counts
   */
  async listSubscriptions() {
    const plans = await this.prisma.subscription.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return plans.map((p) => ({
      id: p.id,
      planName: p.planName,
      requestLimit: p.requestLimit,
      subscriberCount: p._count.users,
    }));
  }

  /**
   * 3. Subscription Management: Assign Plan to User
   */
  async updateUserSubscription(userId: string, planName: PlanType) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let plan = await this.prisma.subscription.findFirst({
      where: { planName },
    });

    if (!plan) {
      plan = await this.prisma.subscription.create({
        data: {
          planName,
          requestLimit: planName === PlanType.PREMIUM ? 1000 : 50,
        },
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: plan.id },
      include: { subscription: true },
    });

    return {
      message: `User subscription updated to ${planName}`,
      user: {
        id: updated.id,
        email: updated.email,
        subscription: updated.subscription,
      },
    };
  }

  /**
   * 4. API Usage Analytics
   */
  async getUsageAnalytics() {
    const logs = await this.prisma.apiUsageLog.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const totalRequests = logs.length;
    const avgLatency =
      totalRequests > 0
        ? Math.round(
            logs.reduce((sum, l) => sum + l.latencyMs, 0) / totalRequests,
          )
        : 0;

    // Requests by endpoint
    const endpointCounts: Record<string, number> = {};
    for (const l of logs) {
      endpointCounts[l.endpoint] = (endpointCounts[l.endpoint] || 0) + 1;
    }

    // Status code breakdown
    const statusCodes: Record<string, number> = {
      '2xx': 0,
      '4xx': 0,
      '5xx': 0,
    };
    for (const l of logs) {
      if (l.statusCode >= 200 && l.statusCode < 300) statusCodes['2xx']++;
      else if (l.statusCode >= 400 && l.statusCode < 500) statusCodes['4xx']++;
      else if (l.statusCode >= 500) statusCodes['5xx']++;
    }

    return {
      totalLoggedRequests: totalRequests,
      averageLatencyMs: avgLatency,
      statusCodes,
      topEndpoints: Object.entries(endpointCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([endpoint, count]) => ({ endpoint, count })),
    };
  }

  /**
   * 5. Request Logs (Paginated)
   */
  async getLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.apiUsageLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.apiUsageLog.count(),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 6. System Health & Diagnostics
   */
  async getSystemHealth() {
    const startDb = Date.now();
    let dbStatus = 'CONNECTED';
    let dbLatencyMs = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startDb;
    } catch (e: any) {
      dbStatus = 'DISCONNECTED';
    }

    const memoryUsage = process.memoryUsage();

    return {
      status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMB: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        },
        nodeVersion: process.version,
        platform: os.platform(),
        timestamp: new Date().toISOString(),
      },
    };
  }
}

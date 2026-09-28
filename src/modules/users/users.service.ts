import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PlanType } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        requestsCount: true,
        createdAt: true,
        subscription: {
          select: {
            planName: true,
            requestLimit: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const remainingRequests = Math.max(
      0,
      user.subscription.requestLimit - user.requestsCount,
    );

    return {
      ...user,
      remainingRequests,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValid = await argon2.verify(user.password, dto.currentPassword);
    if (!isValid) {
      throw new BadRequestException('Current password does not match');
    }

    const newHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: newHash,
        hashedRefreshToken: null, // Invalidate active session so user re-logs in
      },
    });

    return { message: 'Password changed successfully. Please log in with your new password.' };
  }

  async upgradePlan(userId: string) {
    let premiumPlan = await this.prisma.subscription.findFirst({
      where: { planName: PlanType.PREMIUM },
    });

    if (!premiumPlan) {
      premiumPlan = await this.prisma.subscription.create({
        data: { planName: PlanType.PREMIUM, requestLimit: 1000 },
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: premiumPlan.id },
      include: { subscription: true },
    });

    return {
      message: 'Subscription successfully upgraded to PREMIUM (1,000 requests limit)!',
      subscription: updated.subscription,
    };
  }

  async updateProfile(userId: string, name?: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        requestsCount: true,
        subscription: true,
        createdAt: true,
      },
    });

    return {
      message: 'Profile updated successfully',
      user: updated,
    };
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscription: true,
        requestsCount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const remainingRequests = Math.max(
      0,
      user.subscription.requestLimit - user.requestsCount,
    );

    return {
      planName: user.subscription.planName,
      requestLimit: user.subscription.requestLimit,
      requestsCount: user.requestsCount,
      remainingRequests,
      status: 'ACTIVE',
    };
  }

  async downgradePlan(userId: string) {
    let freePlan = await this.prisma.subscription.findFirst({
      where: { planName: PlanType.FREE },
    });

    if (!freePlan) {
      freePlan = await this.prisma.subscription.create({
        data: { planName: PlanType.FREE, requestLimit: 50 },
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: freePlan.id },
      include: { subscription: true },
    });

    return {
      message: 'Subscription downgraded to FREE (50 requests limit)',
      subscription: updated.subscription,
    };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'Account deleted successfully' };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}

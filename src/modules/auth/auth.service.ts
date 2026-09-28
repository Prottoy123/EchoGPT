import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Role, PlanTier, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const emailVerifyToken = uuidv4();

    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setDate(now.getDate() + 30);

    // Create user and auto-attach FREE subscription
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.USER,
        isEmailVerified: false,
        emailVerifyToken,
        subscription: {
          create: {
            plan: PlanTier.FREE,
            status: SubscriptionStatus.ACTIVE,
            monthlyRequestLimit: 50,
            monthlyTokenLimit: 100000,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        emailVerifyToken: true,
        createdAt: true,
        subscription: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.createSession(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        subscription: user.subscription,
      },
      tokens,
      verificationToken: emailVerifyToken,
      message: 'Account registered successfully. Welcome to EchoGPT!',
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.createSession(user.id, tokens.refreshToken, ipAddress, userAgent);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        subscription: user.subscription,
      },
      tokens,
    };
  }

  async refresh(dto: RefreshTokenDto, ipAddress?: string, userAgent?: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'echogpt_super_secret_jwt_refresh_key_min_32_characters_67890',
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    const hashedToken = this.hashToken(dto.refreshToken);

    const session = await this.prisma.session.findFirst({
      where: {
        userId: payload.sub,
        hashedRefreshToken: hashedToken,
        isRevoked: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session expired or revoked. Please log in again.');
    }

    // Revoke old session (Rotation)
    await this.prisma.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // Issue fresh tokens
    const tokens = await this.generateTokens(session.user.id, session.user.email, session.user.role);
    await this.createSession(session.user.id, tokens.refreshToken, ipAddress, userAgent);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const hashedToken = this.hashToken(refreshToken);
      await this.prisma.session.updateMany({
        where: {
          userId,
          hashedRefreshToken: hashedToken,
        },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all active sessions for this user
      await this.prisma.session.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
      },
    });

    return { message: 'Email verified successfully. You may now enjoy full access.' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET') || 'echogpt_super_secret_jwt_access_key_min_32_characters_12345';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'echogpt_super_secret_jwt_refresh_key_min_32_characters_67890';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return this.prisma.session.create({
      data: {
        userId,
        hashedRefreshToken: this.hashToken(refreshToken),
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent || 'Unknown Device',
        expiresAt,
      },
    });
  }
}

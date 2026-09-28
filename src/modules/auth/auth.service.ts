import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as argon2 from 'argon2';
import { Role, PlanType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const hashedPassword = await argon2.hash(dto.password);

    // Ensure default FREE subscription exists
    let freePlan = await this.prisma.subscription.findFirst({
      where: { planName: PlanType.FREE },
    });
    if (!freePlan) {
      freePlan = await this.prisma.subscription.create({
        data: { planName: PlanType.FREE, requestLimit: 50 },
      });
    }

    // Create User with FREE plan
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        role: Role.USER,
        subscriptionId: freePlan.id,
      },
      include: { subscription: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const hashedRefreshToken = await argon2.hash(tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        requestsCount: user.requestsCount,
        subscription: user.subscription,
      },
      tokens,
      message: 'Account registered successfully',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { subscription: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValid = await argon2.verify(user.password, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const hashedRefreshToken = await argon2.hash(tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        requestsCount: user.requestsCount,
        subscription: user.subscription,
      },
      tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'echogpt_super_secret_jwt_refresh_key_min_32_characters_67890',
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('Invalid session or revoked token');
    }

    const matches = await argon2.verify(user.hashedRefreshToken, dto.refreshToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    // Token Rotation
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const newHashedRefreshToken = await argon2.hash(tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { hashedRefreshToken: newHashedRefreshToken },
    });

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'echogpt_super_secret_jwt_access_key_min_32_characters_12345';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'echogpt_super_secret_jwt_refresh_key_min_32_characters_67890';

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
      expiresIn: 900,
    };
  }
}

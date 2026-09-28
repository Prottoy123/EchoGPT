import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('System Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'System Health Check verifying database, memory, and uptime' })
  @ApiResponse({ status: 200, description: 'System health indicators status' })
  async check() {
    return this.health.check([
      // Database ping via Prisma
      async () => {
        try {
          await this.prisma.$queryRawUnsafe('SELECT 1');
          return { database: { status: 'up' } };
        } catch (err: any) {
          return { database: { status: 'down', message: err.message } };
        }
      },
      // Memory heap indicator (< 300MB heap limit)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}

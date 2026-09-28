import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API');

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const startTime = Date.now();

    const { method, url, user } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const latencyMs = Date.now() - startTime;
          const statusCode = res.statusCode || 200;
          this.logUsage(method, url, statusCode, latencyMs, user?.id);
        },
        error: (err) => {
          const latencyMs = Date.now() - startTime;
          const statusCode = err.status || 500;
          this.logUsage(method, url, statusCode, latencyMs, user?.id);
        },
      }),
    );
  }

  private logUsage(
    method: string,
    endpoint: string,
    statusCode: number,
    latencyMs: number,
    userId?: string,
  ) {
    // Non-blocking asynchronous log persistence
    this.prisma.apiUsageLog
      .create({
        data: {
          method,
          endpoint,
          statusCode,
          latencyMs,
          userId: userId || null,
        },
      })
      .catch((err) => {
        this.logger.debug(`Failed to record API log: ${err.message}`);
      });
  }
}

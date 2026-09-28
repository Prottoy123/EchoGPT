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
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const userId = req.user?.id || null;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;

        this.logger.log(`${method} ${originalUrl} ${statusCode} - ${durationMs}ms`);

        // Asynchronously persist to ApiUsageLog
        this.prisma.apiUsageLog
          .create({
            data: {
              userId,
              endpoint: originalUrl,
              method,
              statusCode,
              durationMs,
              ipAddress: ip,
              userAgent,
            },
          })
          .catch((err) => {
            this.logger.warn(`Failed to persist usage log: ${err.message}`);
          });
      }),
    );
  }
}

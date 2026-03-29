import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { KafkaProducerService } from '../kafka-producer.service';
import { KAFKA_TOPICS } from '@app/shared';

@Injectable()
export class LogPublisherInterceptor implements NestInterceptor {
  constructor(private readonly kafkaProducer: KafkaProducerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.publishLog('info', context, {
            method,
            url,
            statusCode: response.statusCode,
            durationMs: Date.now() - start,
          });
        },
        error: (error: Error) => {
          this.publishLog('error', context, {
            method,
            url,
            error: error.message,
            stack: error.stack,
            durationMs: Date.now() - start,
          });
        },
      }),
    );
  }

  private publishLog(
    level: string,
    context: ExecutionContext,
    metadata: Record<string, unknown>,
  ): void {
    const logEntry = {
      level,
      timestamp: new Date().toISOString(),
      service: 'nestjs-api',
      context: context.getClass().name,
      message: `${metadata.method} ${metadata.url} ${metadata.statusCode ?? 'ERROR'}`,
      metadata,
    };

    this.kafkaProducer.publish(KAFKA_TOPICS.APP_LOGS, logEntry).catch(() => {
      // Silently drop — avoid cascading failures on log delivery
    });
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bull';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { CacheModule } from './cache/cache.module';
import { EmailModule } from './email/email.module';
import { PropertyModule } from './property/property.module';
import { ScraperModule } from './scraper/scraper.module';
import { ReportModule } from './report/report.module';
import { KafkaProducerService } from './common/kafka-producer.service';
import { LogPublisherInterceptor } from './common/interceptors/log-publisher.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info').toLowerCase(),
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          serializers: {
            req: (req: Record<string, unknown>) => ({
              method: req.method,
              url: req.url,
            }),
            res: (res: Record<string, unknown>) => ({
              statusCode: res.statusCode,
            }),
          },
          customProps: () => ({ service: 'nestjs-api' }),
        },
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'real_estate_ai'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
    }),

    CacheModule,
    EmailModule,
    PropertyModule,
    ScraperModule,
    ReportModule,
  ],
  providers: [
    KafkaProducerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LogPublisherInterceptor,
    },
  ],
})
export class AppModule {}

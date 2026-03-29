import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Logger } from '@nestjs/common';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, LogEntryDto, initKafkaConsumerWithRetry } from '@app/shared';
import { Log } from '../log.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

const VALID_LEVELS = new Set(['info', 'warn', 'error', 'debug']);
const VALID_SERVICES = new Set(['nestjs-api', 'python']);

@Injectable()
export class LogConsumerService implements OnModuleInit {
  private consumer: Consumer;
  private readonly logger = new Logger(LogConsumerService.name);

  constructor(
    @InjectRepository(Log)
    private readonly logRepo: Repository<Log>,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const kafka = new Kafka({
      clientId: 'logger-service',
      brokers: [this.config.get<string>('KAFKA_BROKER', 'kafka:9092')],
    });
    this.consumer = kafka.consumer({
      groupId: KAFKA_CONSUMER_GROUPS.LOGGER_SERVICE,
    });
  }

  async onModuleInit(): Promise<void> {
    await initKafkaConsumerWithRetry({
      consumer: this.consumer,
      topic: KAFKA_TOPICS.APP_LOGS,
      logger: this.logger,
      handler: async (payload: EachMessagePayload) => {
        try {
          const raw = JSON.parse(payload.message.value!.toString());
          const entry = this.validate(raw);
          if (!entry) {
            this.logger.warn(
              `Malformed log message at offset ${payload.message.offset} — dead-lettered`,
            );
            return;
          }

          const log = this.logRepo.create({
            level: entry.level,
            service: entry.service,
            context: entry.context,
            message: entry.message,
            metadata: entry.metadata ?? {},
            timestamp: new Date(entry.timestamp),
          });
          const saved = await this.logRepo.save(log);

          this.eventEmitter.emit('log.created', saved);
        } catch (err) {
          this.logger.error(`Failed to process log message: ${err}`);
        }
      },
    });
  }

  private validate(raw: Record<string, unknown>): LogEntryDto | null {
    if (
      typeof raw.level !== 'string' ||
      !VALID_LEVELS.has(raw.level) ||
      typeof raw.service !== 'string' ||
      !VALID_SERVICES.has(raw.service) ||
      typeof raw.context !== 'string' ||
      typeof raw.message !== 'string' ||
      typeof raw.timestamp !== 'string'
    ) {
      return null;
    }

    return raw as unknown as LogEntryDto;
  }
}

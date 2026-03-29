import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, PropertyLinkMessage, initKafkaConsumerWithRetry } from '@app/shared';
import { ScraperService } from './scraper.service';
import { TriggerLogService } from '../common/trigger-log.service';

@Injectable()
export class ScraperConsumer implements OnModuleInit {
  private consumer: Consumer;

  constructor(
    private readonly config: ConfigService,
    private readonly scraperService: ScraperService,
    private readonly triggerLog: TriggerLogService,
    @InjectPinoLogger(ScraperConsumer.name)
    private readonly logger: PinoLogger,
  ) {
    const kafka = new Kafka({
      clientId: 'nestjs-api-scraper',
      brokers: [this.config.get<string>('KAFKA_BROKER', 'kafka:9092')],
    });
    this.consumer = kafka.consumer({
      groupId: `${KAFKA_CONSUMER_GROUPS.NESTJS_API}-scraper`,
    });
  }

  async onModuleInit(): Promise<void> {
    await initKafkaConsumerWithRetry({
      consumer: this.consumer,
      topic: KAFKA_TOPICS.PROPERTY_LINKS,
      logger: this.logger,
      handler: async (payload: EachMessagePayload) => {
        try {
          const data: PropertyLinkMessage = JSON.parse(
            payload.message.value!.toString(),
          );
          this.logger.info({ url: data.url }, 'Received property link');

          await this.triggerLog.log(
            data.requestId,
            `Scraping process started for ${data.url}`,
          );

          await this.scraperService.enqueueScrapeJob(data);
        } catch (err) {
          this.logger.error({ err, offset: payload.message.offset }, 'Failed to process property link');
        }
      },
    });
  }
}

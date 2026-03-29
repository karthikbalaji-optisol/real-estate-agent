import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { KAFKA_TOPICS, KAFKA_CONSUMER_GROUPS, ScrapeResultMessage, initKafkaConsumerWithRetry } from '@app/shared';
import { PropertyService } from './property.service';
import { PropertyGateway } from './property.gateway';
import { TriggerLogService } from '../common/trigger-log.service';

@Injectable()
export class PropertyConsumer implements OnModuleInit {
  private consumer: Consumer;

  constructor(
    private readonly config: ConfigService,
    private readonly propertyService: PropertyService,
    private readonly propertyGateway: PropertyGateway,
    private readonly triggerLog: TriggerLogService,
    @InjectPinoLogger(PropertyConsumer.name)
    private readonly logger: PinoLogger,
  ) {
    const kafka = new Kafka({
      clientId: 'nestjs-api-property',
      brokers: [this.config.get<string>('KAFKA_BROKER', 'kafka:9092')],
    });
    this.consumer = kafka.consumer({
      groupId: `${KAFKA_CONSUMER_GROUPS.NESTJS_API}-property`,
    });
  }

  async onModuleInit(): Promise<void> {
    await initKafkaConsumerWithRetry({
      consumer: this.consumer,
      topic: KAFKA_TOPICS.SCRAPE_RESULTS,
      logger: this.logger,
      handler: async (payload: EachMessagePayload) => {
        try {
          const data: ScrapeResultMessage = JSON.parse(
            payload.message.value!.toString(),
          );
          this.logger.info({ url: data.url }, 'Received scrape result');

          const property = await this.propertyService.upsertFromScrape({
            url: data.url,
            sourceEmail: data.sourceEmail,
            bhk: data.bhk,
            bathrooms: data.bathrooms,
            price: data.price,
            plotArea: data.plotArea,
            builtUpArea: data.builtUpArea,
            location: data.location,
            facing: data.facing,
            floors: data.floors,
          });

          await this.triggerLog.log(
            data.requestId,
            `Property listed successfully — ${data.url} (${property.location ?? 'unknown location'}, ${property.bhk ?? '?'} BHK, ${property.price ?? 'price N/A'})`,
          );

          this.propertyGateway.broadcastPropertyUpdate('property_created', {
            id: property.id,
            url: property.url,
            location: property.location,
            bhk: property.bhk,
            price: property.price,
          });
        } catch (err) {
          this.logger.error({ err, offset: payload.message.offset }, 'Failed to process scrape result');
        }
      },
    });
  }
}

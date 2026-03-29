import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ScraperProcessor } from './scraper.processor';
import { ScraperConsumer } from './scraper.consumer';
import { KafkaProducerService } from '../common/kafka-producer.service';
import { TriggerLogModule } from '../common/trigger-log.module';
import { ManualTrigger } from './manual-trigger.entity';
import { ManualTriggerLog } from './manual-trigger-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ManualTrigger, ManualTriggerLog]),
    TriggerLogModule,
    BullModule.registerQueue({
      name: 'scraper',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  controllers: [ScraperController],
  providers: [ScraperService, ScraperProcessor, ScraperConsumer, KafkaProducerService],
})
export class ScraperModule {}

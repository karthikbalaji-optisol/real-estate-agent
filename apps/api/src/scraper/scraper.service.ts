import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { KafkaProducerService } from '../common/kafka-producer.service';
import { KAFKA_TOPICS, PropertyLinkMessage } from '@app/shared';
import { ManualTrigger } from './manual-trigger.entity';
import { ManualTriggerLog } from './manual-trigger-log.entity';

@Injectable()
export class ScraperService {
  constructor(
    @InjectQueue('scraper') private readonly scraperQueue: Queue,
    @InjectRepository(ManualTrigger)
    private readonly triggerRepo: Repository<ManualTrigger>,
    @InjectRepository(ManualTriggerLog)
    private readonly triggerLogRepo: Repository<ManualTriggerLog>,
    private readonly kafkaProducer: KafkaProducerService,
    @InjectPinoLogger(ScraperService.name)
    private readonly logger: PinoLogger,
  ) {}

  async triggerManual(): Promise<ManualTrigger> {
    const trigger = this.triggerRepo.create({ status: 'pending' });
    await this.triggerRepo.save(trigger);

    await this.triggerLogRepo.save(
      this.triggerLogRepo.create({
        requestId: trigger.requestId,
        level: 'info',
        message: 'Manual trigger created, publishing event to Python service',
      }),
    );

    await this.kafkaProducer.publish(KAFKA_TOPICS.EMAIL_CHECK_TRIGGER, {
      requestId: trigger.requestId,
      trigger: 'manual',
      triggeredAt: trigger.startedAt.toISOString(),
    });

    this.logger.info(
      { requestId: trigger.requestId },
      'Published email.check.trigger event',
    );

    return trigger;
  }

  async findAllTriggers(): Promise<ManualTrigger[]> {
    return this.triggerRepo.find({
      order: { startedAt: 'DESC' },
      take: 50,
    });
  }

  async findTriggerByRequestId(
    requestId: string,
  ): Promise<ManualTrigger | null> {
    return this.triggerRepo.findOne({
      where: { requestId },
      relations: ['logs'],
      order: { logs: { createdAt: 'ASC' } },
    });
  }

  async enqueueScrapeJob(data: PropertyLinkMessage): Promise<void> {
    const job = await this.scraperQueue.add('scrape', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.info({ jobId: job.id, url: data.url }, 'Scrape job enqueued');
  }
}

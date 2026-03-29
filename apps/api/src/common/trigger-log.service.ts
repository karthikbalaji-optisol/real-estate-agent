import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ManualTriggerLog } from '../scraper/manual-trigger-log.entity';

@Injectable()
export class TriggerLogService {
  constructor(
    @InjectRepository(ManualTriggerLog)
    private readonly logRepo: Repository<ManualTriggerLog>,
  ) {}

  async log(
    requestId: string | undefined,
    message: string,
    level: string = 'info',
  ): Promise<void> {
    if (!requestId) return;
    try {
      await this.logRepo.save(
        this.logRepo.create({ requestId, message, level }),
      );
    } catch {
      // best-effort logging — don't crash the pipeline
    }
  }
}

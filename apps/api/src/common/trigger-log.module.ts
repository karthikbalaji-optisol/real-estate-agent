import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualTriggerLog } from '../scraper/manual-trigger-log.entity';
import { TriggerLogService } from './trigger-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([ManualTriggerLog])],
  providers: [TriggerLogService],
  exports: [TriggerLogService],
})
export class TriggerLogModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from '../log.entity';
import { LogConsumerService } from './log-consumer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Log])],
  providers: [LogConsumerService],
  exports: [LogConsumerService],
})
export class LogConsumerModule {}

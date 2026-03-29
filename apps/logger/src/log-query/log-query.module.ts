import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from '../log.entity';
import { LogQueryController } from './log-query.controller';
import { LogQueryService } from './log-query.service';

@Module({
  imports: [TypeOrmModule.forFeature([Log])],
  controllers: [LogQueryController],
  providers: [LogQueryService],
})
export class LogQueryModule {}

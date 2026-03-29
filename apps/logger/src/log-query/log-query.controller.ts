import { Controller, Get, Query, Sse } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Observable, fromEvent, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogQueryService, LogQueryParams } from './log-query.service';
import { Log } from '../log.entity';

@ApiTags('Logs')
@Controller('logs')
export class LogQueryController {
  constructor(
    private readonly logQueryService: LogQueryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Query logs with filters and pagination' })
  @ApiQuery({ name: 'level', required: false, enum: ['info', 'warn', 'error', 'debug'] })
  @ApiQuery({ name: 'service', required: false, enum: ['nestjs-api', 'python'] })
  @ApiQuery({ name: 'context', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 date' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 date' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  query(@Query() params: LogQueryParams) {
    return this.logQueryService.query(params);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE endpoint — stream new log entries in real time' })
  stream(): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'log.created').pipe(
      map((log: Log) => ({
        data: JSON.stringify({
          id: log.id,
          level: log.level,
          service: log.service,
          context: log.context,
          message: log.message,
          metadata: log.metadata,
          timestamp: log.timestamp,
        }),
      } as MessageEvent)),
    );
  }
}

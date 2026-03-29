import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Log } from '../log.entity';

@WebSocketGateway({
  namespace: '/logs-gateway',
  cors: { origin: '*' },
})
export class LogGatewayGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LogGatewayGateway.name);

  @OnEvent('log.created')
  handleLogCreated(log: Log): void {
    this.server.emit('log', {
      id: log.id,
      level: log.level,
      service: log.service,
      context: log.context,
      message: log.message,
      metadata: log.metadata,
      timestamp: log.timestamp,
    });
  }
}

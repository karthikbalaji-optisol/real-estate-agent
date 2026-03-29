import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@WebSocketGateway({ cors: { origin: '*' } })
export class PropertyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectPinoLogger(PropertyGateway.name)
    private readonly logger: PinoLogger,
  ) {}

  afterInit(): void {
    this.logger.info('Property WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.info({ clientId: client.id }, 'Client connected');
  }

  handleDisconnect(client: Socket): void {
    this.logger.info({ clientId: client.id }, 'Client disconnected');
  }

  broadcastPropertyUpdate(
    event: 'property_created' | 'property_updated',
    data: Record<string, unknown>,
  ): void {
    this.server.emit(event, data);
  }
}

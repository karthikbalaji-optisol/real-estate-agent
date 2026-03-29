import { Module } from '@nestjs/common';
import { LogGatewayGateway } from './log-gateway.gateway';

@Module({
  providers: [LogGatewayGateway],
  exports: [LogGatewayGateway],
})
export class LogGatewayModule {}

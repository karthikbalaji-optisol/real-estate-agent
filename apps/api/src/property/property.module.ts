import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './property.entity';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { PropertyGateway } from './property.gateway';
import { PropertyConsumer } from './property.consumer';
import { TriggerLogModule } from '../common/trigger-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Property]), TriggerLogModule],
  controllers: [PropertyController],
  providers: [PropertyService, PropertyGateway, PropertyConsumer],
  exports: [PropertyService, PropertyGateway],
})
export class PropertyModule {}

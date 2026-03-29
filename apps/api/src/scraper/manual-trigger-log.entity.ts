import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManualTrigger } from './manual-trigger.entity';

@Entity('manual_trigger_logs')
export class ManualTriggerLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ default: 'info' })
  level: string;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ManualTrigger, (trigger) => trigger.logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'request_id' })
  trigger: ManualTrigger;
}

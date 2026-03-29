import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManualTriggerLog } from './manual-trigger-log.entity';

@Entity('manual_triggers')
export class ManualTrigger {
  @PrimaryGeneratedColumn('uuid', { name: 'request_id' })
  requestId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  status: 'pending' | 'running' | 'completed' | 'failed';

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'accounts_checked', type: 'int', default: 0 })
  accountsChecked: number;

  @Column({ name: 'emails_found', type: 'int', default: 0 })
  emailsFound: number;

  @Column({ name: 'urls_extracted', type: 'int', default: 0 })
  urlsExtracted: number;

  @OneToMany(() => ManualTriggerLog, (log) => log.trigger, { eager: false })
  logs: ManualTriggerLog[];
}

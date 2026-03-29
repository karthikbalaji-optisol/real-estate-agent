import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: ['info', 'warn', 'error', 'debug'],
  })
  level: 'info' | 'warn' | 'error' | 'debug';

  @Index()
  @Column({
    type: 'enum',
    enum: ['nestjs-api', 'python'],
  })
  service: 'nestjs-api' | 'python';

  @Column()
  context: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Index()
  @Column({ type: 'timestamptz' })
  timestamp: Date;
}

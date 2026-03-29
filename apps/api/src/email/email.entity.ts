import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('emails')
export class EmailAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'encrypted_app_password' })
  encryptedAppPassword: string;

  @Column({ default: 'google' })
  provider: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'is_valid', type: 'boolean', nullable: true, default: null })
  isValid: boolean | null;

  @Column({
    name: 'last_checked_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  lastCheckedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

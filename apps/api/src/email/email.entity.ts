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

  @Column({ name: 'encrypted_app_password', type: 'varchar', nullable: true, default: null })
  encryptedAppPassword: string | null;

  @Column({ default: 'google' })
  provider: string;

  @Column({ name: 'auth_method', default: 'password' })
  authMethod: string;

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

  @Column({ name: 'oauth_refresh_token', type: 'text', nullable: true, default: null })
  oauthRefreshToken: string | null;

  @Column({
    name: 'oauth_token_expires_at',
    type: 'timestamptz',
    nullable: true,
    default: null,
  })
  oauthTokenExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

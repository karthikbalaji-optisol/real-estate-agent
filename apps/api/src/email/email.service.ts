import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EmailAccount } from './email.entity';
import { CreateEmailDto } from './dto/create-email.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { EmailResponseDto } from './dto/email-response.dto';
import { encrypt, maskPassword } from '../common/encryption.util';
import { getImapHost } from '../common/imap-providers';

@Injectable()
export class EmailService {
  private readonly encryptionKey: string;
  private readonly msClientId: string;
  private readonly msClientSecret: string;
  private readonly msTenantId: string;
  private readonly msRedirectUri: string;

  constructor(
    @InjectRepository(EmailAccount)
    private readonly emailRepo: Repository<EmailAccount>,
    private readonly config: ConfigService,
    @InjectPinoLogger(EmailService.name)
    private readonly logger: PinoLogger,
  ) {
    this.encryptionKey = this.config.getOrThrow<string>('EMAIL_ENCRYPTION_KEY');
    this.msClientId = this.config.get<string>('MS_OAUTH_CLIENT_ID', '');
    this.msClientSecret = this.config.get<string>('MS_OAUTH_CLIENT_SECRET', '');
    this.msTenantId = this.config.get<string>('MS_OAUTH_TENANT_ID', 'common');
    this.msRedirectUri = this.config.get<string>(
      'MS_OAUTH_REDIRECT_URI',
      'http://localhost:3000/api/emails/outlook/callback',
    );
  }

  // ────────────────────────────────────────────────────
  // Microsoft OAuth 2.0
  // ────────────────────────────────────────────────────

  getOutlookAuthUrl(): string {
    if (!this.msClientId) {
      throw new BadRequestException('MS_OAUTH_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: this.msClientId,
      response_type: 'code',
      redirect_uri: this.msRedirectUri,
      response_mode: 'query',
      scope: 'offline_access https://outlook.office365.com/IMAP.AccessAsUser.All',
      prompt: 'consent',
    });

    return `https://login.microsoftonline.com/${this.msTenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleOutlookCallback(code: string): Promise<EmailResponseDto> {
    // Exchange authorization code for tokens
    const tokenUrl = `https://login.microsoftonline.com/${this.msTenantId}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      client_id: this.msClientId,
      client_secret: this.msClientSecret,
      code,
      redirect_uri: this.msRedirectUri,
      grant_type: 'authorization_code',
      scope: 'offline_access https://outlook.office365.com/IMAP.AccessAsUser.All',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      this.logger.error({ error: errorData }, 'Failed to exchange OAuth code');
      throw new BadRequestException('Failed to exchange authorization code');
    }

    const tokenData = await response.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in ?? 3600;

    // Decode the access token to get the email address (JWT payload)
    const email = this.extractEmailFromToken(accessToken);
    if (!email) {
      throw new BadRequestException('Could not determine email from OAuth token');
    }

    // Check for existing account
    const existing = await this.emailRepo.findOne({ where: { email } });
    if (existing) {
      // Update existing account with new tokens
      existing.authMethod = 'oauth';
      existing.oauthRefreshToken = encrypt(refreshToken, this.encryptionKey);
      existing.oauthTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
      existing.encryptedAppPassword = null;
      existing.isValid = true;
      existing.lastCheckedAt = new Date();
      existing.enabled = true;

      const saved = await this.emailRepo.save(existing);
      this.logger.info({ email }, 'Outlook OAuth tokens updated for existing account');
      return this.toResponse(saved);
    }

    // Create new account
    const entity = this.emailRepo.create({
      email,
      encryptedAppPassword: null,
      provider: 'outlook',
      authMethod: 'oauth',
      oauthRefreshToken: encrypt(refreshToken, this.encryptionKey),
      oauthTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      isValid: true,
      lastCheckedAt: new Date(),
    });

    const saved = await this.emailRepo.save(entity);
    this.logger.info({ email, provider: 'outlook' }, 'Outlook OAuth account created');
    return this.toResponse(saved);
  }

  private extractEmailFromToken(accessToken: string): string | null {
    try {
      // JWT: header.payload.signature
      const payload = accessToken.split('.')[1];
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      // Microsoft tokens use 'upn' or 'unique_name' or 'preferred_username'
      return decoded.upn || decoded.unique_name || decoded.preferred_username || decoded.email || null;
    } catch {
      this.logger.warn('Failed to decode JWT to extract email');
      return null;
    }
  }

  // ────────────────────────────────────────────────────
  // CRUD (existing + modified)
  // ────────────────────────────────────────────────────

  async create(dto: CreateEmailDto): Promise<EmailResponseDto> {
    if (dto.provider === 'outlook') {
      throw new BadRequestException(
        'Outlook accounts must be connected via OAuth. Use the "Connect with Microsoft" button.',
      );
    }

    if (!dto.appPassword) {
      throw new BadRequestException('App password is required for non-OAuth providers');
    }

    const existing = await this.emailRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const encrypted = encrypt(dto.appPassword, this.encryptionKey);
    const host = getImapHost(dto.provider);
    const isValid = host
      ? await this.validateCredentials(dto.email, dto.appPassword, host)
      : null;

    const entity = this.emailRepo.create({
      email: dto.email,
      encryptedAppPassword: encrypted,
      provider: dto.provider,
      authMethod: 'password',
      isValid,
      lastCheckedAt: new Date(),
    });

    const saved = await this.emailRepo.save(entity);
    this.logger.info({ email: dto.email, provider: dto.provider, isValid }, 'Email account created');
    return this.toResponse(saved);
  }

  async findAll(): Promise<EmailResponseDto[]> {
    const accounts = await this.emailRepo.find({
      order: { createdAt: 'DESC' },
    });
    return accounts.map((a) => this.toResponse(a));
  }

  async update(id: string, dto: UpdateEmailDto): Promise<EmailResponseDto> {
    const account = await this.emailRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Email not found');

    Object.assign(account, dto);
    const saved = await this.emailRepo.save(account);
    this.logger.info({ id, enabled: saved.enabled }, 'Email account updated');
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.emailRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Email not found');
    this.logger.info({ id }, 'Email account removed');
  }

  private async validateCredentials(
    email: string,
    password: string,
    host: string,
  ): Promise<boolean> {
    try {
      const { ImapFlow } = await import('imapflow');
      const client = new ImapFlow({
        host,
        port: 993,
        secure: true,
        auth: { user: email, pass: password },
        logger: false,
      });
      await client.connect();
      await client.logout();
      return true;
    } catch {
      this.logger.warn({ email }, 'IMAP credential validation failed');
      return false;
    }
  }

  private toResponse(entity: EmailAccount): EmailResponseDto {
    const dto = new EmailResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.maskedPassword = entity.authMethod === 'oauth'
      ? '(OAuth)'
      : entity.encryptedAppPassword
        ? maskPassword(entity.encryptedAppPassword)
        : '—';
    dto.provider = entity.provider;
    dto.authMethod = entity.authMethod;
    dto.enabled = entity.enabled;
    dto.isValid = entity.isValid;
    dto.lastCheckedAt = entity.lastCheckedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

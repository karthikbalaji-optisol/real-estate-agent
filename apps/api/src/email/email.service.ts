import {
  ConflictException,
  Injectable,
  NotFoundException,
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
import { CacheService } from '../cache/cache.service';
import { getImapHost } from '../common/imap-providers';

@Injectable()
export class EmailService {
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(EmailAccount)
    private readonly emailRepo: Repository<EmailAccount>,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    @InjectPinoLogger(EmailService.name)
    private readonly logger: PinoLogger,
  ) {
    this.encryptionKey = this.config.getOrThrow<string>('EMAIL_ENCRYPTION_KEY');
  }

  async create(dto: CreateEmailDto): Promise<EmailResponseDto> {
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
    dto.maskedPassword = maskPassword(entity.encryptedAppPassword);
    dto.provider = entity.provider;
    dto.enabled = entity.enabled;
    dto.isValid = entity.isValid;
    dto.lastCheckedAt = entity.lastCheckedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

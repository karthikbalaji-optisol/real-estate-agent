import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

export const EMAIL_PROVIDERS = ['google', 'outlook', 'yahoo'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export class CreateEmailDto {
  @ApiProperty({ example: 'user@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'abcd efgh ijkl mnop', description: 'App password (never returned in responses)' })
  @IsString()
  @IsNotEmpty()
  appPassword: string;

  @ApiProperty({ enum: EMAIL_PROVIDERS, example: 'google', description: 'Email provider for IMAP server resolution' })
  @IsIn(EMAIL_PROVIDERS)
  provider: EmailProvider;
}

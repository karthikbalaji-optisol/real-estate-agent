import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class EmailResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  email: string;

  @Expose()
  @ApiProperty({ description: 'Masked app password (e.g. ****mnop)' })
  maskedPassword: string;

  @Expose()
  @ApiProperty({ description: 'Email provider (google, outlook, yahoo)' })
  provider: string;

  @Expose()
  @ApiProperty({ description: 'Authentication method: password or oauth' })
  authMethod: string;

  @Expose()
  @ApiProperty()
  enabled: boolean;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  isValid: boolean | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  lastCheckedAt: Date | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}

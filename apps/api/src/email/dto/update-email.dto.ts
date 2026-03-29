import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateEmailDto {
  @ApiPropertyOptional({ example: true, description: 'Toggle email monitoring on/off' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

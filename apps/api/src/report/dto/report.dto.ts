import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @ApiPropertyOptional({ example: 'daily', description: 'Report type (daily, weekly, custom)' })
  @IsString()
  @IsOptional()
  type?: string;
}

export class ReportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  createdAt: Date;
}

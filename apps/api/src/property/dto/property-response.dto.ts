import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PropertyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional()
  bhk?: number;

  @ApiPropertyOptional()
  bathrooms?: number;

  @ApiPropertyOptional()
  price?: string;

  @ApiPropertyOptional()
  plotArea?: string;

  @ApiPropertyOptional()
  builtUpArea?: string;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  facing?: string;

  @ApiPropertyOptional()
  floors?: number;

  @ApiPropertyOptional()
  sourceEmail?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedPropertyResponseDto {
  @ApiProperty({ type: [PropertyResponseDto] })
  data: PropertyResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

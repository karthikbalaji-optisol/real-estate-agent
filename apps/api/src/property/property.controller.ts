import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PropertyService } from './property.service';
import {
  PaginatedPropertyResponseDto,
  PropertyResponseDto,
} from './dto/property-response.dto';

@ApiTags('Properties')
@Controller('properties')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Get()
  @ApiOperation({ summary: 'List scraped properties (paginated, cached)' })
  @ApiOkResponse({ type: PaginatedPropertyResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'bhk', required: false, type: Number })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('location') location?: string,
    @Query('bhk') bhk?: number,
  ): Promise<PaginatedPropertyResponseDto> {
    const parsedBhk = bhk != null ? Number(bhk) : undefined;
    return this.propertyService.findAll(
      page ? +page : 1,
      limit ? +limit : 20,
      location,
      Number.isFinite(parsedBhk) ? parsedBhk : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single property detail' })
  @ApiOkResponse({ type: PropertyResponseDto })
  @ApiNotFoundResponse({ description: 'Property not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PropertyResponseDto> {
    return this.propertyService.findOne(id);
  }
}

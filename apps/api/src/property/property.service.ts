import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Property } from './property.entity';
import { CacheService } from '../cache/cache.service';
import {
  PaginatedPropertyResponseDto,
  PropertyResponseDto,
} from './dto/property-response.dto';

const CACHE_TTL_LIST = 300; // 5 min
const CACHE_TTL_DETAIL = 600; // 10 min

@Injectable()
export class PropertyService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    private readonly cache: CacheService,
    @InjectPinoLogger(PropertyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
    location?: string,
    bhk?: number,
  ): Promise<PaginatedPropertyResponseDto> {
    const cacheKey = `properties:list:${page}:${limit}:${location ?? ''}:${bhk ?? ''}`;
    const cached =
      await this.cache.get<PaginatedPropertyResponseDto>(cacheKey);
    if (cached) return cached;

    const qb = this.propertyRepo.createQueryBuilder('p');
    if (location) qb.andWhere('p.location = :location', { location });
    if (bhk != null) qb.andWhere('p.bhk = :bhk', { bhk });

    const [data, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const result: PaginatedPropertyResponseDto = {
      data: data.map((p) => this.toDto(p)),
      total,
      page,
      limit,
    };

    await this.cache.set(cacheKey, result, CACHE_TTL_LIST);
    return result;
  }

  async findOne(id: string): Promise<PropertyResponseDto> {
    const cacheKey = `properties:detail:${id}`;
    const cached = await this.cache.get<PropertyResponseDto>(cacheKey);
    if (cached) return cached;

    const property = await this.propertyRepo.findOne({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');

    const dto = this.toDto(property);
    await this.cache.set(cacheKey, dto, CACHE_TTL_DETAIL);
    return dto;
  }

  async upsertFromScrape(data: {
    url: string;
    sourceEmail?: string;
    bhk?: number;
    bathrooms?: number;
    price?: string;
    plotArea?: string;
    builtUpArea?: string;
    location?: string;
    facing?: string;
    floors?: number;
  }): Promise<Property> {
    let property = await this.propertyRepo.findOne({
      where: { url: data.url },
    });

    if (property) {
      Object.assign(property, data);
    } else {
      property = this.propertyRepo.create(data);
    }

    const saved = await this.propertyRepo.save(property);
    this.logger.info(
      { id: saved.id, url: saved.url },
      'Property upserted from scrape',
    );

    await this.cache.invalidatePattern('properties:*');
    return saved;
  }

  private toDto(p: Property): PropertyResponseDto {
    return {
      id: p.id,
      url: p.url,
      bhk: p.bhk,
      bathrooms: p.bathrooms,
      price: p.price,
      plotArea: p.plotArea,
      builtUpArea: p.builtUpArea,
      location: p.location,
      facing: p.facing,
      floors: p.floors,
      sourceEmail: p.sourceEmail,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}

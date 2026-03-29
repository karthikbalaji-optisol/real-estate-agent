import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Log } from '../log.entity';

export interface LogQueryParams {
  level?: string;
  service?: string;
  context?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class LogQueryService {
  constructor(
    @InjectRepository(Log)
    private readonly logRepo: Repository<Log>,
  ) {}

  async query(params: LogQueryParams): Promise<{
    data: Log[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const where: FindOptionsWhere<Log> = {};

    if (params.level) {
      where.level = params.level as Log['level'];
    }
    if (params.service) {
      where.service = params.service as Log['service'];
    }
    if (params.context) {
      where.context = params.context;
    }
    if (params.search) {
      where.message = ILike(`%${params.search}%`);
    }
    if (params.from && params.to) {
      where.timestamp = Between(new Date(params.from), new Date(params.to));
    }

    const [data, total] = await this.logRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}

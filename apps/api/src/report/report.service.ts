import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Report } from './report.entity';
import { PropertyService } from '../property/property.service';
import { ReportResponseDto } from './dto/report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    private readonly propertyService: PropertyService,
    @InjectPinoLogger(ReportService.name)
    private readonly logger: PinoLogger,
  ) {}

  async generate(type = 'daily'): Promise<ReportResponseDto> {
    const { data: properties, total } = await this.propertyService.findAll(
      1,
      1000,
    );

    const locationCounts: Record<string, number> = {};
    for (const p of properties) {
      if (p.location) {
        locationCounts[p.location] = (locationCounts[p.location] || 0) + 1;
      }
    }

    const lines = [
      `Property Report — ${new Date().toISOString().split('T')[0]}`,
      '='.repeat(40),
      `Total Listings: ${total}`,
      '',
      'Locations:',
      ...Object.entries(locationCounts).map(
        ([loc, cnt]) => `  - ${loc}: ${cnt}`,
      ),
      '',
      'Recent Properties:',
      ...properties.slice(0, 10).map(
        (p, i) =>
          `  ${i + 1}. ${p.bhk ?? '?'} BHK — ${p.location ?? 'Unknown'} — ${p.price ?? 'N/A'}`,
      ),
    ];
    const content = lines.join('\n');

    const report = this.reportRepo.create({
      name: `${type}_report_${new Date().toISOString().split('T')[0]}`,
      type,
      content,
    });
    const saved = await this.reportRepo.save(report);
    this.logger.info({ id: saved.id, type }, 'Report generated');

    return { id: saved.id, name: saved.name, type: saved.type, createdAt: saved.createdAt };
  }

  async findAll(): Promise<ReportResponseDto[]> {
    const reports = await this.reportRepo.find({
      order: { createdAt: 'DESC' },
    });
    return reports.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      createdAt: r.createdAt,
    }));
  }

  async download(id: string): Promise<{ filename: string; content: string }> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    return { filename: `${report.name}.txt`, content: report.content };
  }
}

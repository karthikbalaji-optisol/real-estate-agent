import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportService } from './report.service';
import { CreateReportDto, ReportResponseDto } from './dto/report.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'List all generated reports' })
  @ApiOkResponse({ type: [ReportResponseDto] })
  findAll(): Promise<ReportResponseDto[]> {
    return this.reportService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new report from property data' })
  @ApiCreatedResponse({ type: ReportResponseDto })
  generate(@Body() dto: CreateReportDto): Promise<ReportResponseDto> {
    return this.reportService.generate(dto.type);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a report as text file' })
  @ApiNotFoundResponse({ description: 'Report not found' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, content } = await this.reportService.download(id);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}

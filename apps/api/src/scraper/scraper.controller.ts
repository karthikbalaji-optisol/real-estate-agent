import { Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ScraperService } from './scraper.service';

@ApiTags('Scraper')
@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('trigger')
  @ApiOperation({
    summary: 'Create a manual trigger — publishes event to Python service',
  })
  @ApiCreatedResponse({ description: 'Trigger created and event published' })
  async trigger() {
    return this.scraperService.triggerManual();
  }

  @Get('triggers')
  @ApiOperation({ summary: 'List all manual triggers (most recent first)' })
  @ApiOkResponse({ description: 'Array of manual trigger records' })
  findAll() {
    return this.scraperService.findAllTriggers();
  }

  @Get('triggers/:requestId')
  @ApiOperation({
    summary: 'Get a single trigger with its logs by request_id',
  })
  @ApiOkResponse({ description: 'Trigger with nested logs array' })
  async findOne(@Param('requestId') requestId: string) {
    const trigger =
      await this.scraperService.findTriggerByRequestId(requestId);
    if (!trigger) throw new NotFoundException('Trigger not found');
    return trigger;
  }
}

import { ApiProperty } from '@nestjs/swagger';
import { IsUrl } from 'class-validator';

export class TriggerScrapeDto {
  @ApiProperty({
    example: 'https://www.99acres.com/2-bhk-apartment-for-sale-spid-X12345',
    description: 'Property listing URL to scrape',
  })
  @IsUrl()
  url: string;
}

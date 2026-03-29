import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright';
import { KafkaProducerService } from '../common/kafka-producer.service';
import { TriggerLogService } from '../common/trigger-log.service';
import { KAFKA_TOPICS, PropertyLinkMessage, ScrapeResultMessage } from '@app/shared';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

@Processor('scraper')
export class ScraperProcessor {
  private readonly timeout: number;
  private readonly waitMs: number;

  constructor(
    private readonly kafkaProducer: KafkaProducerService,
    private readonly config: ConfigService,
    private readonly triggerLog: TriggerLogService,
    @InjectPinoLogger(ScraperProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    this.timeout = Number(this.config.get('SCRAPER_TIMEOUT', '60000'));
    this.waitMs = Number(this.config.get('SCRAPER_WAIT_MS', '5000'));
  }

  @Process({ name: 'scrape', concurrency: 1 })
  async handleScrape(job: Job<PropertyLinkMessage>): Promise<void> {
    const { url, sourceEmail, requestId } = job.data;
    this.logger.info({ url, jobId: job.id }, 'Starting scrape');

    await this.triggerLog.log(requestId, `Scraping page: ${url}`);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const context = await browser.newContext({ userAgent: USER_AGENT });
      const page = await context.newPage();

      await page.goto(url, { timeout: this.timeout });
      await page.waitForTimeout(this.waitMs);
      const bodyText = await page.locator('body').innerText();

      this.logger.info(
        { url, chars: bodyText.length },
        'Page scraped successfully',
      );

      const result: ScrapeResultMessage = {
        url,
        sourceEmail,
        scrapedAt: new Date().toISOString(),
        requestId,
        ...this.extractBasicData(bodyText, url),
      };

      await this.kafkaProducer.publish(KAFKA_TOPICS.SCRAPE_RESULTS, result);
      this.logger.info({ url }, 'Scrape result published to Kafka');

      await this.triggerLog.log(
        requestId,
        `Scraping process done for ${url} — extracted: bhk=${result.bhk ?? '?'}, price=${result.price ?? '?'}, location=${result.location ?? '?'}`,
      );
    } catch (err) {
      this.logger.error({ err, url }, 'Scrape failed');
      await this.triggerLog.log(
        requestId,
        `Scraping failed for ${url}: ${err}`,
        'error',
      );
      throw err;
    } finally {
      await browser.close();
    }
  }

  private extractBasicData(
    text: string,
    url?: string,
  ): Partial<ScrapeResultMessage> {
    const bhkMatch = text.match(/(\d+)\s*BHK/i);
    const bathMatch = text.match(/(\d+)\s*bath/i);
    const areaMatch = text.match(/([\d,.]+)\s*sq\.?\s*ft/i);
    const facingMatch = text.match(/(?:facing|direction)\s*[:\-]?\s*(north|south|east|west|north-east|north-west|south-east|south-west)/i);
    const floorsMatch = text.match(/(\d+)\s*(?:floor|storey)/i);

    const area = areaMatch ? parseFloat(areaMatch[1].replace(/,/g, '')) : undefined;

    return {
      bhk: bhkMatch ? parseInt(bhkMatch[1], 10) : undefined,
      bathrooms: bathMatch ? parseInt(bathMatch[1], 10) : undefined,
      price: this.extractPrice(text, area),
      builtUpArea: area ? `${areaMatch![1]} sq.ft` : undefined,
      location: this.extractLocation(text, url),
      facing: facingMatch ? facingMatch[1].trim() : undefined,
      floors: floorsMatch ? parseInt(floorsMatch[1], 10) : undefined,
    };
  }

  private extractPrice(text: string, areaSqft?: number): string | undefined {
    const directPricePattern = /(?:₹|Rs\.?)\s*([\d,.]+)\s*(Cr|Crore|L|Lac|Lakh)?\b/gi;
    const perSqftPattern = /(?:₹|Rs\.?)\s*([\d,.]+)\s*(?:\/|\s*per\s*)(?:sq\.?\s*ft|sqft)/i;

    const perSqftMatch = text.match(perSqftPattern);
    const ratePerSqft = perSqftMatch
      ? parseFloat(perSqftMatch[1].replace(/,/g, ''))
      : undefined;

    let bestPrice: string | undefined;

    let match: RegExpExecArray | null;
    while ((match = directPricePattern.exec(text)) !== null) {
      const raw = match[0];
      const after = text.slice(match.index + raw.length, match.index + raw.length + 10);
      if (/^\s*(?:\/|per\s*)(?:sq|sft)/i.test(after)) continue;

      const value = parseFloat(match[1].replace(/,/g, ''));
      const unit = (match[2] ?? '').toLowerCase();

      if (!unit && value < 50000) continue;

      bestPrice = `₹ ${match[1]}${unit ? ` ${match[2]}` : ''}`;
      break;
    }

    if (!bestPrice && ratePerSqft && areaSqft) {
      const total = ratePerSqft * areaSqft;
      if (total >= 10000000) {
        bestPrice = `₹ ${(total / 10000000).toFixed(2)} Cr`;
      } else if (total >= 100000) {
        bestPrice = `₹ ${(total / 100000).toFixed(2)} L`;
      } else {
        bestPrice = `₹ ${total.toLocaleString('en-IN')}`;
      }
    }

    return bestPrice;
  }

  private extractLocation(text: string, url?: string): string | undefined {
    const locationPatterns = [
      /(?:location|address|locality)\s*[:\-]?\s*([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+(?:\s*-\s*[A-Za-z]+)?(?:,\s*[A-Z][a-zA-Z\s]+)?)/,
      /(?:in|at)\s+([A-Z][a-zA-Z]+(?:\s[a-zA-Z]+)?,\s*[A-Z][a-zA-Z]+(?:\s*-\s*[A-Za-z]+)?(?:,\s*[A-Z][a-zA-Z\s]+)?)/,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    if (url) {
      const urlLocation = this.extractLocationFromUrl(url);
      if (urlLocation) return urlLocation;
    }

    return undefined;
  }

  private extractLocationFromUrl(url: string): string | undefined {
    const mbMatch = url.match(/Sale-([A-Za-z-]+)-in-([A-Za-z-]+)/i);
    if (mbMatch) {
      const locality = mbMatch[1].replace(/-/g, ' ');
      const city = mbMatch[2].replace(/-/g, ' ');
      return `${locality}, ${city}`;
    }

    const acresMatch = url.match(/in-([a-z-]+?)-(\d+)-sq/i);
    if (acresMatch) {
      return acresMatch[1].replace(/-/g, ' ');
    }

    const housingMatch = url.match(/housing\.com\/in\/(?:buy|rent)\/[^/]+\/[^/]+\/[^/]+-in-([a-z-]+)/i);
    if (housingMatch) {
      return housingMatch[1].replace(/-/g, ' ');
    }

    return undefined;
  }
}

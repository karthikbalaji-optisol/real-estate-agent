export class ScrapeResultMessage {
  url: string;
  sourceEmail: string;
  bhk?: number;
  bathrooms?: number;
  price?: string;
  plotArea?: string;
  builtUpArea?: string;
  location?: string;
  facing?: string;
  floors?: number;
  scrapedAt: string;
  requestId?: string;
}

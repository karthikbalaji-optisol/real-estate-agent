export const KAFKA_TOPICS = {
  PROPERTY_LINKS: 'property.links',
  SCRAPE_RESULTS: 'scrape.results',
  APP_LOGS: 'app.logs',
  EMAIL_CHECK_TRIGGER: 'email.check.trigger',
} as const;

export const KAFKA_CONSUMER_GROUPS = {
  NESTJS_API: 'nestjs-api',
  LOGGER_SERVICE: 'logger-service',
} as const;

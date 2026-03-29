import { Consumer } from 'kafkajs';

interface KafkaRetryLogger {
  warn: (msg: string) => void;
  error: (msg: string) => void;
  log?: (msg: string) => void;
  info?: (msg: string) => void;
}

interface KafkaConsumerInitOptions {
  consumer: Consumer;
  topic: string;
  fromBeginning?: boolean;
  handler: (payload: import('kafkajs').EachMessagePayload) => Promise<void>;
  logger: KafkaRetryLogger;
  maxRetries?: number;
  baseDelayMs?: number;
}

function logInfo(logger: KafkaRetryLogger, msg: string): void {
  if (logger.info) logger.info(msg);
  else if (logger.log) logger.log(msg);
}

export async function initKafkaConsumerWithRetry(opts: KafkaConsumerInitOptions): Promise<void> {
  const {
    consumer,
    topic,
    fromBeginning = false,
    handler,
    logger,
    maxRetries = 15,
    baseDelayMs = 3000,
  } = opts;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning });
      await consumer.run({ eachMessage: handler });
      logInfo(logger, `Subscribed to "${topic}" (attempt ${attempt})`);
      return;
    } catch (err) {
      const delay = Math.min(baseDelayMs * attempt, 30_000);
      logger.warn(
        `Failed to subscribe to "${topic}" (attempt ${attempt}/${maxRetries}): ${err}. Retrying in ${delay}ms…`,
      );

      try { await consumer.disconnect(); } catch { /* ignore */ }

      if (attempt === maxRetries) {
        logger.error(`Exhausted ${maxRetries} retries for topic "${topic}". Giving up.`);
        throw err;
      }

      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

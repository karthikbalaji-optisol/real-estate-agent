"""
Python service entry point.

Starts:
  1. IMAP IDLE listeners for real-time email monitoring.
  2. Kafka consumer for manual `email.check.trigger` events.
"""

from __future__ import annotations

import asyncio
import signal

from shared.log_producer import configure_logging, get_logger, shutdown_producer
from shared.kafka_producer import shutdown as shutdown_kafka
from modules.llm.llm_service import get_chat_model
from modules.extractor.extractor_service import ExtractorService
from modules.email_monitor.email_service import EmailService
from modules.email_monitor.trigger_consumer import EmailCheckTriggerConsumer

logger = get_logger('Main')

_shutdown_event = asyncio.Event()


async def main() -> None:
    configure_logging()
    logger.info('Python service starting')

    llm = get_chat_model()
    extractor = ExtractorService(llm)
    email_service = EmailService(extractor)
    trigger_consumer = EmailCheckTriggerConsumer(email_service, extractor)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: _shutdown_event.set())

    try:
        email_task = asyncio.create_task(email_service.start())
        trigger_task = asyncio.create_task(trigger_consumer.start())
        shutdown_task = asyncio.create_task(_shutdown_event.wait())
        done, _ = await asyncio.wait(
            [email_task, trigger_task, shutdown_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
    except asyncio.CancelledError:
        pass
    finally:
        logger.info('Shutting down gracefully')
        trigger_consumer.stop()
        await email_service.stop()
        await shutdown_kafka()
        await shutdown_producer()
        logger.info('Python service stopped')


if __name__ == '__main__':
    asyncio.run(main())

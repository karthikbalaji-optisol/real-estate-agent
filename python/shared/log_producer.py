"""
Shared structured logging with Kafka transport.

Every log call is:
  1. Rendered as structured JSON to stdout via structlog.
  2. Published to Kafka topic ``app.logs`` so the Logger Service can persist it.

Usage:
    from shared.log_producer import get_logger
    logger = get_logger('ExtractorService')
    logger.info('Processing email', email_id='abc123')
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

import structlog
from aiokafka import AIOKafkaProducer

from config import KAFKA_BROKER

TOPIC = 'app.logs'

_producer: AIOKafkaProducer | None = None
_loop: asyncio.AbstractEventLoop | None = None


async def _get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKER,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        )
        await _producer.start()
    return _producer


async def shutdown_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None


def _kafka_processor(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor that publishes each log entry to Kafka."""
    level = method_name
    entry = {
        'level': level,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'service': 'python',
        'context': event_dict.pop('_context', 'python'),
        'message': event_dict.pop('event', ''),
        'metadata': {k: v for k, v in event_dict.items() if not k.startswith('_')},
    }

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_publish(entry))
    except RuntimeError:
        pass

    event_dict['event'] = entry['message']
    return event_dict


async def _publish(entry: dict[str, Any]) -> None:
    try:
        producer = await _get_producer()
        await producer.send(TOPIC, entry)
    except Exception:
        pass


def configure_logging() -> None:
    """Call once at startup to configure structlog with JSON + Kafka."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt='iso'),
            _kafka_processor,
            structlog.dev.ConsoleRenderer()
            if True
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(0),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(context: str) -> structlog.BoundLogger:
    return structlog.get_logger(_context=context)

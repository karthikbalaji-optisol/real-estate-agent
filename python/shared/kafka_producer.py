"""
Async Kafka producer for publishing property link messages.
"""

from __future__ import annotations

import json

from aiokafka import AIOKafkaProducer

from config import KAFKA_BROKER

TOPIC_PROPERTY_LINKS = 'property.links'

_producer: AIOKafkaProducer | None = None


async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BROKER,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        )
        await _producer.start()
    return _producer


async def publish_property_link(
    url: str,
    source_email: str,
    email_id: str,
    request_id: str | None = None,
) -> None:
    from datetime import datetime, timezone

    producer = await get_producer()
    message: dict = {
        'url': url,
        'sourceEmail': source_email,
        'emailId': email_id,
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }
    if request_id:
        message['requestId'] = request_id
    await producer.send(TOPIC_PROPERTY_LINKS, message)


async def shutdown() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None

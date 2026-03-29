"""
ExtractorModule — classifies emails via LLM and extracts property URLs.

Receives email content from the EmailModule, uses the LLMModule to:
  1. Classify whether the email is real-estate related.
  2. Extract property listing URLs from the body.
Publishes matching URLs to Kafka topic ``property.links``.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Protocol

from config import PROPERTY_SITES
from shared.log_producer import get_logger
from shared.kafka_producer import publish_property_link
from modules.llm.llm_service import LLMConnector

if TYPE_CHECKING:
    from modules.email_monitor.imap_listener import ParsedEmail

logger = get_logger('ExtractorService')

_URL_PATTERN = re.compile(r'https?://[^\s<>"]+')

_RE_KEYWORDS = ('bhk', 'property', 'plot', 'flat', 'apartment', 'villa', 'house')


class TriggerLogger(Protocol):
    def log(self, request_id: str, message: str, level: str = 'info') -> None: ...


class ExtractorService:
    """Classifies emails and extracts property URLs for Kafka publishing."""

    def __init__(self, llm: LLMConnector) -> None:
        self._llm = llm

    async def process_email(
        self,
        email: 'ParsedEmail',
        request_id: str | None = None,
        db_logger: TriggerLogger | None = None,
    ) -> int:
        """Process an email and return the number of URLs published."""
        def _log(msg: str, level: str = 'info') -> None:
            if request_id and db_logger:
                db_logger.log(request_id, msg, level)

        _log(f'Checking for real-estate related content — subject: "{email.subject}"')

        is_real_estate = self._classify(email.subject, email.body)
        if not is_real_estate:
            logger.debug('Email not real-estate related', subject=email.subject)
            _log(f'Email not real-estate related — skipping: "{email.subject}"')
            return 0

        logger.info(
            'Real-estate email detected',
            sender=email.sender,
            subject=email.subject,
        )
        _log(f'Real-estate email detected — subject: "{email.subject}"')

        urls = self._extract_urls(email.body)
        logger.info('Extracted property URLs', count=len(urls), urls=urls)

        if not urls:
            _log('No property URLs found in email body')
            return 0

        _log(f'Identified {len(urls)} property URL(s)')

        for url in urls:
            _log(f'Identified property URL: {url}')
            await publish_property_link(
                url=url,
                source_email=email.sender,
                email_id=email.account_id,
                request_id=request_id,
            )
            _log(f'Published property link to scraping pipeline: {url}')
            logger.info('Published property link to Kafka', url=url)

        return len(urls)

    def _classify(self, subject: str, body: str) -> bool:
        combined = f'{subject} {body}'.lower()
        if any(kw in combined for kw in _RE_KEYWORDS):
            return True

        prompt = (
            'Classify this email.\n\n'
            'Return ONLY "YES" or "NO".\n\n'
            'YES = email is about real estate, property, rent, sale, '
            'housing, listings\n'
            'NO = unrelated (ads, newsletters, tech, promotions)\n\n'
            f'Subject: {subject}\n\nBody:\n{body[:1000]}'
        )

        result = self._llm.generate(
            system_prompt='You classify emails.',
            user_prompt=prompt,
            temperature=0,
        )
        return result.strip().upper() == 'YES'

    def _extract_urls(self, body: str) -> list[str]:
        urls = _URL_PATTERN.findall(body)
        return [
            url
            for url in urls
            if any(site in url for site in PROPERTY_SITES)
        ]

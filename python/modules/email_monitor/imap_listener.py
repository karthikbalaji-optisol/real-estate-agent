"""
IMAP IDLE listener — maintains a persistent IMAP connection per email account.

When the mail server signals new mail, it fetches the message and passes
it to the ExtractorService for classification and URL extraction.
"""

from __future__ import annotations

import asyncio
import email as email_lib
import re
from email.message import Message
from dataclasses import dataclass

from imapclient import IMAPClient

from config import EMAIL_IDLE_TIMEOUT, EMAIL_IDLE_RECONNECT_DELAY
from shared.log_producer import get_logger

logger = get_logger('ImapIdleListener')


@dataclass(frozen=True)
class ParsedEmail:
    subject: str
    sender: str
    body: str
    account_id: str


class ImapIdleListener:
    """Listens on an IMAP mailbox via IDLE and processes emails in real time."""

    def __init__(
        self,
        email_user: str,
        email_password: str,
        imap_server: str,
        account_id: str,
        extractor,
        mailbox: str = 'INBOX',
    ) -> None:
        self._email_user = email_user
        self._email_password = email_password
        self._imap_server = imap_server
        self._account_id = account_id
        self._extractor = extractor
        self._mailbox = mailbox
        self._client: IMAPClient | None = None
        self._running = True

    def _connect(self) -> None:
        self._client = IMAPClient(self._imap_server, ssl=True)
        self._client.login(self._email_user, self._email_password)
        self._client.select_folder(self._mailbox)
        logger.info(
            'IDLE listener connected',
            email=self._email_user,
            mailbox=self._mailbox,
        )

    def _disconnect(self) -> None:
        if self._client:
            try:
                self._client.logout()
            except Exception:
                pass
            self._client = None

    async def _fetch_and_process(self, msg_uids: list[int]) -> None:
        if not msg_uids or not self._client:
            return

        raw_messages = self._client.fetch(msg_uids, ['RFC822'])
        for uid, data in raw_messages.items():
            raw_bytes = data.get(b'RFC822')
            if not raw_bytes:
                continue

            msg = email_lib.message_from_bytes(raw_bytes)
            parsed = ParsedEmail(
                subject=msg.get('subject', ''),
                sender=msg.get('from', ''),
                body=self._extract_body(msg),
                account_id=self._account_id,
            )

            logger.info(
                'New email received',
                sender=parsed.sender,
                subject=parsed.subject,
            )
            try:
                await self._extractor.process_email(parsed)
            except Exception:
                logger.exception('Error processing email', subject=parsed.subject)

    async def run(self) -> None:
        while self._running:
            try:
                await asyncio.to_thread(self._connect)
                await self._idle_loop()
            except Exception:
                logger.exception(
                    'IDLE listener error, reconnecting',
                    email=self._email_user,
                    delay=EMAIL_IDLE_RECONNECT_DELAY,
                )
            finally:
                self._disconnect()

            if self._running:
                await asyncio.sleep(EMAIL_IDLE_RECONNECT_DELAY)

        logger.info('IDLE listener stopped', email=self._email_user)

    async def _idle_loop(self) -> None:
        while self._running:
            await asyncio.to_thread(self._client.idle)
            responses = await asyncio.to_thread(
                self._client.idle_check, EMAIL_IDLE_TIMEOUT
            )
            await asyncio.to_thread(self._client.idle_done)

            new_uids: list[int] = []
            for resp in responses:
                if isinstance(resp, tuple) and len(resp) >= 2:
                    if resp[1] == b'EXISTS':
                        uids = self._client.search(['UNSEEN'])
                        new_uids.extend(uids)
                        break

            if new_uids:
                await self._fetch_and_process(new_uids)

    def stop(self) -> None:
        self._running = False

    @staticmethod
    def _extract_body(msg: Message) -> str:
        if msg.is_multipart():
            for part in msg.walk():
                content_disposition = str(part.get('Content-Disposition'))
                if 'attachment' in content_disposition:
                    continue
                content_type = part.get_content_type()
                if content_type == 'text/plain':
                    return part.get_payload(decode=True).decode(errors='ignore')
                if content_type == 'text/html':
                    html = part.get_payload(decode=True).decode(errors='ignore')
                    return re.sub(r'<.*?>', '', html)
        else:
            return msg.get_payload(decode=True).decode(errors='ignore')
        return ''

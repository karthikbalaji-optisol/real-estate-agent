"""
IMAP IDLE listener — maintains a persistent IMAP connection per email account.

When the mail server signals new mail, it fetches the message and passes
it to the ExtractorService for classification and URL extraction.

For Sent folders, messages are typically auto-marked as read, so instead
of relying on the UNSEEN flag we track the highest processed UID and
fetch messages by SINCE date, only processing those with UIDs above the
last-seen watermark.
"""

from __future__ import annotations

import asyncio
import email as email_lib
import re
from datetime import datetime, timezone
from email.message import Message
from dataclasses import dataclass

from imapclient import IMAPClient

from config import EMAIL_IDLE_TIMEOUT, EMAIL_IDLE_RECONNECT_DELAY
from shared.log_producer import get_logger

logger = get_logger('ImapIdleListener')

# Folder name fragments that identify a "Sent" mailbox
_SENT_FOLDER_MARKERS = ('sent', 'Sent Mail')


def _is_sent_folder(mailbox: str) -> bool:
    """Return True if *mailbox* looks like a Sent-items folder."""
    return any(marker.lower() in mailbox.lower() for marker in _SENT_FOLDER_MARKERS)


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

        self._is_sent = _is_sent_folder(mailbox)
        # Watermark: highest UID we have already processed in this session.
        # Initialised on first connect so we don't re-process old messages.
        self._last_seen_uid: int = 0

    def _connect(self) -> None:
        self._client = IMAPClient(self._imap_server, ssl=True)
        self._client.login(self._email_user, self._email_password)
        self._client.select_folder(self._mailbox)
        logger.info(
            'IDLE listener connected',
            email=self._email_user,
            mailbox=self._mailbox,
        )

        if self._is_sent:
            # Seed the watermark with the current highest UID so we only
            # process messages that arrive *after* the listener starts.
            self._last_seen_uid = self._get_current_max_uid()
            logger.info(
                'Sent-folder watermark initialised',
                email=self._email_user,
                mailbox=self._mailbox,
                last_seen_uid=self._last_seen_uid,
            )

    def _get_current_max_uid(self) -> int:
        """Return the highest UID currently in the selected folder."""
        if not self._client:
            return 0
        try:
            # Fetch messages from today to get a reasonable set
            today = datetime.now(timezone.utc).strftime('%d-%b-%Y')
            uids = self._client.search(['SINCE', today])
            if uids:
                return max(uids)
            # Fallback: search ALL and take the max
            uids = self._client.search(['ALL'])
            return max(uids) if uids else 0
        except Exception:
            logger.exception('Failed to determine max UID')
            return 0

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
                mailbox=self._mailbox,
            )
            try:
                await self._extractor.process_email(parsed)
            except Exception:
                logger.exception('Error processing email', subject=parsed.subject)

        # Update the watermark after successful processing
        if self._is_sent and msg_uids:
            self._last_seen_uid = max(self._last_seen_uid, max(msg_uids))

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
                        if self._is_sent:
                            # Sent items are auto-read — search by date
                            # and only pick UIDs above our watermark.
                            new_uids = self._fetch_new_sent_uids()
                        else:
                            uids = self._client.search(['UNSEEN'])
                            new_uids.extend(uids)
                        break

            if new_uids:
                await self._fetch_and_process(new_uids)

    def _fetch_new_sent_uids(self) -> list[int]:
        """Return UIDs of sent messages that arrived after our watermark."""
        if not self._client:
            return []

        today = datetime.now(timezone.utc).strftime('%d-%b-%Y')
        try:
            uids = self._client.search(['SINCE', today])
        except Exception:
            logger.exception('Failed to search sent folder by date')
            return []

        # Only return UIDs we haven't processed yet
        new_uids = [uid for uid in uids if uid > self._last_seen_uid]
        if new_uids:
            logger.info(
                'New sent items detected',
                email=self._email_user,
                count=len(new_uids),
                since_uid=self._last_seen_uid,
            )
        return new_uids

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

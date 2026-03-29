"""
Kafka consumer for `email.check.trigger` topic.

When the NestJS API publishes a manual trigger event, this consumer
performs an immediate one-time scan of all enabled email accounts.
Every step is logged to the `manual_trigger_logs` table keyed by request_id.

Supports both password-based and OAuth2 (XOAUTH2) authentication.
"""

from __future__ import annotations

import asyncio
import email as email_lib
import json
import re
import uuid
from datetime import datetime, timezone
from email.message import Message

from aiokafka import AIOKafkaConsumer
from imapclient import IMAPClient
from sqlalchemy import create_engine, text

from config import KAFKA_BROKER, DATABASE_URL
from shared.log_producer import get_logger
from modules.email_monitor.email_service import EmailService, EmailAccountInfo, PROVIDER_SENT_FOLDERS
from modules.email_monitor.imap_listener import ParsedEmail
from modules.extractor.extractor_service import ExtractorService

logger = get_logger('TriggerConsumer')

TOPIC = 'email.check.trigger'
GROUP_ID = 'python-trigger'


class TriggerDbLogger:
    """Writes structured step-logs into manual_trigger_logs."""

    def __init__(self, engine) -> None:
        self._engine = engine

    def log(self, request_id: str, message: str, level: str = 'info') -> None:
        try:
            with self._engine.begin() as conn:
                conn.execute(
                    text(
                        'INSERT INTO manual_trigger_logs (id, request_id, level, message) '
                        'VALUES (:id, :rid, :lvl, :msg)'
                    ),
                    {
                        'id': str(uuid.uuid4()),
                        'rid': request_id,
                        'lvl': level,
                        'msg': message,
                    },
                )
        except Exception:
            logger.exception('Failed to write trigger log', request_id=request_id)

    def update_trigger(
        self,
        request_id: str,
        *,
        status: str | None = None,
        ended_at: datetime | None = None,
        accounts_checked: int | None = None,
        emails_found: int | None = None,
        urls_extracted: int | None = None,
    ) -> None:
        sets: list[str] = []
        params: dict = {'rid': request_id}

        if status is not None:
            sets.append('status = :status')
            params['status'] = status
        if ended_at is not None:
            sets.append('ended_at = :ended_at')
            params['ended_at'] = ended_at
        if accounts_checked is not None:
            sets.append('accounts_checked = :ac')
            params['ac'] = accounts_checked
        if emails_found is not None:
            sets.append('emails_found = :ef')
            params['ef'] = emails_found
        if urls_extracted is not None:
            sets.append('urls_extracted = :ue')
            params['ue'] = urls_extracted

        if not sets:
            return

        sql = f'UPDATE manual_triggers SET {", ".join(sets)} WHERE request_id = :rid'
        try:
            with self._engine.begin() as conn:
                conn.execute(text(sql), params)
        except Exception:
            logger.exception('Failed to update trigger', request_id=request_id)


class EmailCheckTriggerConsumer:
    """Listens for manual trigger events and scans all enabled mailboxes."""

    def __init__(
        self,
        email_service: EmailService,
        extractor: ExtractorService,
    ) -> None:
        self._email_service = email_service
        self._extractor = extractor
        self._consumer: AIOKafkaConsumer | None = None
        self._running = True
        self._engine = create_engine(DATABASE_URL)
        self._db = TriggerDbLogger(self._engine)

    async def start(self) -> None:
        self._consumer = AIOKafkaConsumer(
            TOPIC,
            bootstrap_servers=KAFKA_BROKER,
            group_id=GROUP_ID,
            auto_offset_reset='latest',
            value_deserializer=lambda v: json.loads(v.decode('utf-8')),
        )

        retries = 0
        while self._running:
            try:
                await self._consumer.start()
                logger.info('Trigger consumer connected to Kafka')
                break
            except Exception:
                retries += 1
                delay = min(2 ** retries, 30)
                logger.warn('Kafka not ready, retrying', attempt=retries, delay=delay)
                await asyncio.sleep(delay)

        try:
            async for msg in self._consumer:
                payload = msg.value or {}
                request_id = payload.get('requestId')
                if not request_id:
                    logger.warn('Trigger event missing requestId, skipping')
                    continue

                logger.info('Received email.check.trigger', request_id=request_id)
                await self._scan_all_accounts(request_id)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception('Trigger consumer error')
        finally:
            if self._consumer:
                await self._consumer.stop()

    async def _scan_all_accounts(self, request_id: str) -> None:
        db = self._db

        db.update_trigger(request_id, status='running')
        db.log(request_id, 'Email check started')

        accounts = self._email_service.fetch_enabled_accounts()
        db.log(request_id, f'Found {len(accounts)} enabled email account(s)')

        if not accounts:
            db.log(request_id, 'No enabled accounts — nothing to check', level='warn')
            db.update_trigger(
                request_id,
                status='completed',
                ended_at=datetime.now(timezone.utc),
                accounts_checked=0,
            )
            return

        total_emails = 0
        total_urls = 0
        accounts_ok = 0

        for account in accounts:
            db.log(request_id, f'Checking account: {account.email} (auth: {account.auth_method})')
            try:
                parsed_emails = await asyncio.to_thread(
                    self._fetch_unseen, account, request_id
                )

                if not parsed_emails:
                    db.log(request_id, f'No new mail in {account.email}')
                else:
                    db.log(
                        request_id,
                        f'{len(parsed_emails)} new email(s) found in {account.email}',
                    )
                    total_emails += len(parsed_emails)

                    for parsed in parsed_emails:
                        db.log(
                            request_id,
                            f'Processing email — subject: "{parsed.subject}" from {parsed.sender}',
                        )
                        url_count = await self._extractor.process_email(
                            parsed,
                            request_id=request_id,
                            db_logger=db,
                        )
                        total_urls += url_count

                accounts_ok += 1
            except Exception as exc:
                db.log(
                    request_id,
                    f'Failed to check {account.email}: {exc}',
                    level='error',
                )
                logger.exception('Failed to check account', email=account.email)

        db.log(
            request_id,
            f'Scan complete — {accounts_ok} account(s) checked, '
            f'{total_emails} email(s) found, {total_urls} processed',
        )
        db.update_trigger(
            request_id,
            status='completed',
            ended_at=datetime.now(timezone.utc),
            accounts_checked=accounts_ok,
            emails_found=total_emails,
            urls_extracted=total_urls,
        )

    def _fetch_unseen(
        self, account: EmailAccountInfo, request_id: str
    ) -> list[ParsedEmail]:
        """Connect via IMAP, fetch unseen emails from INBOX + Sent, return parsed list."""
        sent_folder = PROVIDER_SENT_FOLDERS.get(account.provider, 'Sent')
        folders = ['INBOX', sent_folder]
        results: list[ParsedEmail] = []

        client = IMAPClient(account.imap_server, ssl=True)
        try:
            if account.auth_method == 'oauth' and account.oauth_access_token:
                # XOAUTH2 authentication
                auth_string = f'user={account.email}\x01auth=Bearer {account.oauth_access_token}\x01\x01'
                client.authenticate('XOAUTH2', lambda _: auth_string.encode())
                self._db.log(request_id, f'IMAP connected via OAuth for {account.email}')
            else:
                # Password-based login
                client.login(account.email, account.password)
                self._db.log(request_id, f'IMAP connected for {account.email}')

            for folder in folders:
                try:
                    client.select_folder(folder)
                    uids = client.search(['UNSEEN'])

                    self._db.log(
                        request_id,
                        f'Folder "{folder}" — {len(uids)} unseen message(s)',
                    )

                    if not uids:
                        continue

                    raw_messages = client.fetch(uids, ['RFC822'])
                    for uid, data in raw_messages.items():
                        raw_bytes = data.get(b'RFC822')
                        if not raw_bytes:
                            continue

                        msg = email_lib.message_from_bytes(raw_bytes)
                        results.append(ParsedEmail(
                            subject=msg.get('subject', ''),
                            sender=msg.get('from', ''),
                            body=self._extract_body(msg),
                            account_id=account.id,
                        ))
                except Exception as exc:
                    self._db.log(
                        request_id,
                        f'Failed to check folder "{folder}" for {account.email}: {exc}',
                        level='error',
                    )
        finally:
            try:
                client.logout()
            except Exception:
                pass

        return results

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

    def stop(self) -> None:
        self._running = False

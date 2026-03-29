"""
EmailModule — IMAP listener for all enabled email accounts.

Polls the shared PostgreSQL database for enabled accounts, decrypts
credentials at runtime, and spawns IMAP IDLE listeners per account.
Periodically re-checks the DB for newly added or removed accounts.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from sqlalchemy import create_engine, text

from config import DATABASE_URL, EMAIL_ENCRYPTION_KEY
from shared.encryption import decrypt
from shared.log_producer import get_logger
from modules.email_monitor.imap_listener import ImapIdleListener
from modules.extractor.extractor_service import ExtractorService

logger = get_logger('EmailService')

PROVIDER_IMAP_HOSTS: dict[str, str] = {
    'google': 'imap.gmail.com',
    'outlook': 'imap-mail.outlook.com',
    'yahoo': 'imap.mail.yahoo.com',
}

PROVIDER_SENT_FOLDERS: dict[str, str] = {
    'google': '[Gmail]/Sent Mail',
    'outlook': 'Sent',
    'yahoo': 'Sent',
}

POLL_INTERVAL_SECONDS = 30


@dataclass(frozen=True)
class EmailAccountInfo:
    id: str
    email: str
    password: str
    imap_server: str
    provider: str


class EmailService:
    """Manages IMAP listeners for all enabled email accounts."""

    def __init__(self, extractor: ExtractorService) -> None:
        self._extractor = extractor
        self._listeners: dict[str, ImapIdleListener] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._engine = create_engine(DATABASE_URL)
        self._running = True

    def fetch_enabled_accounts(self) -> list[EmailAccountInfo]:
        accounts: list[EmailAccountInfo] = []
        try:
            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        'SELECT id, email, encrypted_app_password, provider '
                        'FROM emails WHERE enabled = true'
                    )
                ).fetchall()
        except Exception:
            logger.exception('Failed to query email accounts from DB')
            return accounts

        for row in rows:
            account_id, email, encrypted_pw, provider = row
            imap_server = PROVIDER_IMAP_HOSTS.get(provider or 'google')
            if not imap_server:
                logger.warn('Unsupported email provider, skipping', email=email, provider=provider)
                continue
            try:
                password = decrypt(encrypted_pw, EMAIL_ENCRYPTION_KEY)
            except Exception:
                logger.error('Failed to decrypt password', email=email)
                continue
            accounts.append(
                EmailAccountInfo(
                    id=str(account_id),
                    email=email,
                    password=password,
                    imap_server=imap_server,
                    provider=provider or 'google',
                )
            )
        return accounts

    def _start_listener(self, account: EmailAccountInfo) -> None:
        sent_folder = PROVIDER_SENT_FOLDERS.get(account.provider, 'Sent')
        mailboxes = ['INBOX', sent_folder]

        for mailbox in mailboxes:
            key = f'{account.id}:{mailbox}'
            listener = ImapIdleListener(
                email_user=account.email,
                email_password=account.password,
                imap_server=account.imap_server,
                account_id=account.id,
                extractor=self._extractor,
                mailbox=mailbox,
            )
            self._listeners[key] = listener
            self._tasks[key] = asyncio.create_task(listener.run())

        logger.info('Started IMAP listeners', email=account.email, mailboxes=mailboxes)

    def _stop_listener(self, account_id: str) -> None:
        keys = [k for k in self._listeners if k.startswith(f'{account_id}:')]
        for key in keys:
            listener = self._listeners.pop(key, None)
            task = self._tasks.pop(key, None)
            if listener:
                listener.stop()
            if task and not task.done():
                task.cancel()
        logger.info('Stopped IMAP listeners', account_id=account_id)

    async def _sync_listeners(self) -> None:
        """Reconcile running listeners with current DB state."""
        accounts = self.fetch_enabled_accounts()
        current_ids = {a.id for a in accounts}
        running_account_ids = {k.split(':')[0] for k in self._listeners}

        for aid in running_account_ids - current_ids:
            self._stop_listener(aid)

        for account in accounts:
            if account.id not in running_account_ids:
                self._start_listener(account)

        # Clean up finished tasks and restart if needed
        for key in list(self._tasks.keys()):
            if self._tasks[key].done():
                self._tasks.pop(key)
                self._listeners.pop(key, None)
                aid = key.split(':')[0]
                if aid in current_ids:
                    matching = next((a for a in accounts if a.id == aid), None)
                    if matching:
                        logger.warn('Listener died, restarting', email=matching.email, key=key)
                        mailbox = key.split(':', 1)[1]
                        listener = ImapIdleListener(
                            email_user=matching.email,
                            email_password=matching.password,
                            imap_server=matching.imap_server,
                            account_id=matching.id,
                            extractor=self._extractor,
                            mailbox=mailbox,
                        )
                        self._listeners[key] = listener
                        self._tasks[key] = asyncio.create_task(listener.run())

    async def start(self) -> None:
        """Poll DB for accounts and manage listeners in a loop."""
        logger.info('Email service starting, polling every %ds', POLL_INTERVAL_SECONDS)
        while self._running:
            await self._sync_listeners()
            active = len(self._listeners)
            logger.info('Active IMAP listeners', count=active)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def stop(self) -> None:
        self._running = False
        for aid in list(self._listeners.keys()):
            self._stop_listener(aid)

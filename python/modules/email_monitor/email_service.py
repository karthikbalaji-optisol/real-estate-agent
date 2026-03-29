"""
EmailModule — IMAP listener for all enabled email accounts.

Polls the shared PostgreSQL database for enabled accounts, decrypts
credentials at runtime, and spawns IMAP IDLE listeners per account.
Periodically re-checks the DB for newly added or removed accounts.

Supports both password-based and OAuth2 (XOAUTH2) authentication.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone

from msal import ConfidentialClientApplication
from sqlalchemy import create_engine, text

from config import (
    DATABASE_URL,
    EMAIL_ENCRYPTION_KEY,
    MS_OAUTH_CLIENT_ID,
    MS_OAUTH_CLIENT_SECRET,
    MS_OAUTH_TENANT_ID,
)
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

PROVIDER_OAUTH_IMAP_HOSTS: dict[str, str] = {
    'outlook': 'outlook.office365.com',
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
    password: str | None
    imap_server: str
    provider: str
    auth_method: str
    oauth_refresh_token: str | None
    oauth_access_token: str | None  # populated at runtime after refresh


class EmailService:
    """Manages IMAP listeners for all enabled email accounts."""

    def __init__(self, extractor: ExtractorService) -> None:
        self._extractor = extractor
        self._listeners: dict[str, ImapIdleListener] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._engine = create_engine(DATABASE_URL)
        self._running = True
        self._msal_app: ConfidentialClientApplication | None = None

        # Initialize MSAL app if OAuth credentials are configured
        if MS_OAUTH_CLIENT_ID and MS_OAUTH_CLIENT_SECRET:
            authority = f'https://login.microsoftonline.com/{MS_OAUTH_TENANT_ID}'
            self._msal_app = ConfidentialClientApplication(
                MS_OAUTH_CLIENT_ID,
                authority=authority,
                client_credential=MS_OAUTH_CLIENT_SECRET,
            )
            logger.info('MSAL app initialized for OAuth token refresh')

    def _refresh_oauth_token(self, refresh_token: str) -> dict | None:
        """Use MSAL to refresh an OAuth access token."""
        if not self._msal_app:
            logger.error('MSAL app not configured, cannot refresh OAuth token')
            return None

        try:
            result = self._msal_app.acquire_token_by_refresh_token(
                refresh_token,
                scopes=['https://outlook.office365.com/IMAP.AccessAsUser.All'],
            )

            if 'access_token' in result:
                logger.info('OAuth access token refreshed successfully')
                return result
            else:
                logger.error(
                    'OAuth token refresh failed',
                    error=result.get('error'),
                    description=result.get('error_description'),
                )
                return None
        except Exception:
            logger.exception('Failed to refresh OAuth token')
            return None

    def _update_oauth_tokens_in_db(
        self,
        account_id: str,
        new_refresh_token: str,
        expires_in: int,
    ) -> None:
        """Persist the new refresh token and expiry time in the DB."""
        from shared.encryption import encrypt
        try:
            encrypted_refresh = encrypt(new_refresh_token, EMAIL_ENCRYPTION_KEY)
            expires_at = datetime.now(timezone.utc).replace(
                second=datetime.now(timezone.utc).second
            )
            with self._engine.begin() as conn:
                conn.execute(
                    text(
                        'UPDATE emails SET oauth_refresh_token = :rt, '
                        'oauth_token_expires_at = NOW() + INTERVAL :exp '
                        'WHERE id = :id'
                    ),
                    {
                        'rt': encrypted_refresh,
                        'exp': f'{expires_in} seconds',
                        'id': account_id,
                    },
                )
        except Exception:
            logger.exception('Failed to update OAuth tokens in DB', account_id=account_id)

    def fetch_enabled_accounts(self) -> list[EmailAccountInfo]:
        accounts: list[EmailAccountInfo] = []
        try:
            with self._engine.connect() as conn:
                rows = conn.execute(
                    text(
                        'SELECT id, email, encrypted_app_password, provider, '
                        'auth_method, oauth_refresh_token '
                        'FROM emails WHERE enabled = true'
                    )
                ).fetchall()
        except Exception:
            logger.exception('Failed to query email accounts from DB')
            return accounts

        for row in rows:
            account_id, email, encrypted_pw, provider, auth_method, oauth_refresh_enc = row

            password = None
            oauth_access_token = None
            oauth_refresh_token = None

            if auth_method == 'oauth':
                # OAuth account — refresh the access token
                imap_server = PROVIDER_OAUTH_IMAP_HOSTS.get(provider)
                if not imap_server:
                    logger.warn('No OAuth IMAP host for provider', provider=provider)
                    continue

                if oauth_refresh_enc:
                    try:
                        oauth_refresh_token = decrypt(oauth_refresh_enc, EMAIL_ENCRYPTION_KEY)
                    except Exception:
                        logger.error('Failed to decrypt OAuth refresh token', email=email)
                        continue

                    token_result = self._refresh_oauth_token(oauth_refresh_token)
                    if not token_result:
                        logger.error('Cannot get access token, skipping', email=email)
                        continue

                    oauth_access_token = token_result['access_token']

                    # Update refresh token if a new one was provided
                    new_refresh = token_result.get('refresh_token')
                    if new_refresh and new_refresh != oauth_refresh_token:
                        oauth_refresh_token = new_refresh
                        self._update_oauth_tokens_in_db(
                            str(account_id),
                            new_refresh,
                            token_result.get('expires_in', 3600),
                        )
                else:
                    logger.error('OAuth account missing refresh token', email=email)
                    continue
            else:
                # Password-based account
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
                    auth_method=auth_method or 'password',
                    oauth_refresh_token=oauth_refresh_token,
                    oauth_access_token=oauth_access_token,
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
                auth_method=account.auth_method,
                oauth_access_token=account.oauth_access_token,
            )
            self._listeners[key] = listener
            self._tasks[key] = asyncio.create_task(listener.run())

        logger.info('Started IMAP listeners', email=account.email, auth_method=account.auth_method, mailboxes=mailboxes)

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
                            auth_method=matching.auth_method,
                            oauth_access_token=matching.oauth_access_token,
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

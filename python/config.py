from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / '.env')

OPENAI_API_KEY: str = os.getenv('OPENAI_API_KEY', '')
CHAT_MODEL_NAME: str = os.getenv('CHAT_MODEL_NAME', 'gpt-4o-mini')

DB_HOST: str = os.getenv('DB_HOST', 'localhost')
DB_PORT: int = int(os.getenv('DB_PORT', '5432'))
DB_NAME: str = os.getenv('DB_NAME', 'real_estate_ai')
DB_USER: str = os.getenv('DB_USER', 'postgres')
DB_PASSWORD: str = os.getenv('DB_PASSWORD', '')
DATABASE_URL: str = os.getenv(
    'DATABASE_URL',
    f'postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}',
)

KAFKA_BROKER: str = os.getenv('KAFKA_BROKER', 'kafka:9092')

EMAIL_ENCRYPTION_KEY: str = os.getenv('EMAIL_ENCRYPTION_KEY', '')

EMAIL_IDLE_TIMEOUT: int = int(os.getenv('EMAIL_IDLE_TIMEOUT', '300'))
EMAIL_IDLE_RECONNECT_DELAY: int = int(os.getenv('EMAIL_IDLE_RECONNECT_DELAY', '30'))

# Microsoft OAuth 2.0
MS_OAUTH_CLIENT_ID: str = os.getenv('MS_OAUTH_CLIENT_ID', '')
MS_OAUTH_CLIENT_SECRET: str = os.getenv('MS_OAUTH_CLIENT_SECRET', '')
MS_OAUTH_TENANT_ID: str = os.getenv('MS_OAUTH_TENANT_ID', 'common')

PROPERTY_SITES: list[str] = [
    'magicbricks', '99acres', 'housing',
    'squareyards', 'commonfloor', 'realestateportal',
]

LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO').upper()

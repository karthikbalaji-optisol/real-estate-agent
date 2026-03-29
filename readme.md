# Real Estate Email Automation Agent

## Overview

End-to-end pipeline that monitors IMAP mailboxes for real-estate-related messages, extracts listing URLs, scrapes pages with Playwright, structures fields with OpenAI, stores rows in PostgreSQL, and writes a same-day text report.

## What it does

1. Connects to accounts listed in `email_accounts.json` (see [Configuration](#configuration)).
2. Reads **unseen** messages from **INBOX** and, for Gmail, attempts **Sent Mail** (`"[Gmail]/Sent Mail"`).
3. **Classifies** messages: if the plain/HTML body contains `bhk` or `property` (case-insensitive), the message is treated as real estate; otherwise OpenAI (`gpt-4o-mini`) returns YES/NO.
4. **Extracts URLs** from the body and keeps only links whose host/path mentions allowed property sites (see below).
5. For each link: **scrapes** visible text with Chromium (Playwright), **extracts** JSON with OpenAI (`gpt-4o-mini`), **normalizes** numeric fields (BHK, bathrooms), **inserts** into PostgreSQL.

`run_system.py` runs the monitor and then generates the daily report in one go.

## Architecture

```text
IMAP (unseen) → rule / LLM filter → link detection → Playwright scrape
    → OpenAI JSON extraction → clean BHK & bathrooms → PostgreSQL
run_system.py → daily report (DB query for today) → daily_report_YYYY-MM-DD.txt
```

## Tech stack

| Area | Technology |
|------|------------|
| Email | Python `imaplib`, `email` |
| Scraping | Playwright (Chromium), sync API |
| Classification & extraction | OpenAI API (`gpt-4o-mini`) |
| Database | PostgreSQL, `psycopg2` |
| Orchestration | `run_system.py`, `Emails/monitor.py`, `main_pipeline.py` |

## Project structure

```text
.
├── Emails/
│   └── monitor.py          # IMAP monitor, loads accounts, drives pipeline
├── utils/
│   ├── link_detector.py    # URL extraction + site allowlist
│   └── email_classifier.py # OpenAI YES/NO when keyword shortcut does not apply
├── scraper/
│   └── playwright_scraper.py
├── extractor/
│   └── property_extractor.py
├── database/
│   ├── db_manager.py       # INSERT into properties
│   └── test_db.py          # sample insert helper
├── reporting/
│   └── daily_report.py     # today’s rows → console + dated .txt file
├── main_pipeline.py        # scrape → extract → clean → save_property
├── run_system.py           # monitor + daily report
├── email_accounts.json     # local credentials (gitignored; create your own)
└── readme.md
```

## Property link allowlist

`utils/link_detector.py` keeps URLs only if they contain one of these substrings (case-sensitive substring match on the full URL):

- `magicbricks`
- `99acres`
- `housing`
- `squareyards`
- `commonfloor`
- `realestateportal`

## Data model (PostgreSQL)

`database/db_manager.py` inserts into table `properties` with columns:

`url`, `bhk`, `bathrooms`, `price`, `plot_area`, `built_up_area`, `location`, `facing`, `floors`

The daily report expects a `created_at` column on `properties` (used to filter “today’s” rows). Ensure your table defines it (for example with a default of `now()` on insert).

## Configuration

### Email accounts

Create `email_accounts.json` in the project root (this filename is in `.gitignore`). Each entry:

```json
[
  {
    "email": "you@example.com",
    "password": "your-app-password",
    "imap_server": "imap.gmail.com"
  }
]
```

Use an app password or provider-specific token where required; do not commit real secrets.

### OpenAI

Set the API key in the environment:

```bash
export OPENAI_API_KEY="sk-..."
```

### PostgreSQL

Connection settings appear in **two** places today: `database/db_manager.py` and `reporting/daily_report.py` (`DB_CONFIG`). Align host, database name, user, password, and port in both before running.

### Playwright

The scraper launches Chromium with `headless=False` and uses a 60s navigation timeout plus a 5s wait after load. Adjust in `scraper/playwright_scraper.py` if you run headless on a server.

## Setup and run

There is no `requirements.txt` in this repo; install dependencies explicitly, for example:

```bash
pip install psycopg2-binary openai playwright
playwright install chromium
```

From the repository root:

```bash
python run_system.py
```

Other entry points:

- `python Emails/monitor.py` — email monitoring only  
- `python reporting/daily_report.py` — report only (reads DB for current date)

## Daily report output

`reporting/daily_report.py` prints a short summary and writes `daily_report_<date>.txt` in the current working directory (that pattern is gitignored).

## Security notes

- Keep `email_accounts.json` out of version control (already listed in `.gitignore`).
- Prefer environment variables or a secrets manager for DB credentials instead of hardcoding them in Python modules for anything beyond local development.

## Limitations and follow-ups

- DB credentials are duplicated between `db_manager.py` and `daily_report.py`.
- Keyword shortcut may admit some non–real-estate mail if the body contains `property` in unrelated contexts.
- Gmail Sent folder path may differ by locale/account; failures there are swallowed so INBOX still runs.

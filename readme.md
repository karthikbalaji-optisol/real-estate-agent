# Real Estate Intelligence Platform

## Overview

A comprehensive, event-driven platform that actively monitors email accounts (via standard IMAP), uses LLMs to identify real estate emails and extract property links, scrapes the property pages, structures the information via robust regex parsing, and presents the data in a web dashboard with advanced reporting capabilities.

The project has evolved from a single-script pipeline into a robust microservices architecture.

## Architecture

![Platform Architecture](./image.png)

The system utilizes an event-driven microservices architecture orchestrated with **Docker Compose**:

- **Frontend (`/frontend`)**: React + TypeScript + Vite web application for viewing collected property listings, adding email accounts, and viewing/downloading daily reports.
- **Backend API (`/apps/api`)**: NestJS application managing database operations, user authentication, and serving data to the frontend.
- **Logger Service (`/apps/logger`)**: NestJS microservice handling centralized logging.
- **Python Worker (`/python`)**: A background service that:
  - Constantly monitors registered email inboxes.
  - Uses `elsai-model` (LLM) to intelligently classify real estate emails and extract property listing URLs.
- **Infrastructure**:
  - **Kafka**: Message broker orchestrating events between services (`property.links`, `scrape.results`, `app.logs`, `email.check.trigger`).
  - **PostgreSQL**: Relational database storing email credentials, property records, and system configurations.
  - **Redis**: Caching and managing background job queues.

## Tech Stack

| Component | Technologies |
| --- | --- |
| **Frontend** | React, TypeScript, Vite |
| **Backend** | Node.js, NestJS, TypeORM |
| **Python Worker** | Python 3, `elsai-model`, `aiokafka`, `sqlalchemy`, `httpx` |
| **Databases/Broker**| PostgreSQL, Redis, Apache Kafka |
| **Deployment** | Docker, Docker Compose |

## Environment Setup and Running

### Prerequisites
- Docker & Docker Compose installed on your system.
- Node.js & npm (optional, for local frontend/backend dev instead of Docker).
- Python 3.x (optional, for local worker dev).

### Running with Docker Compose

1. Copy `.env.example` to `.env` in the root directory and populate it with your specific API keys, database credentials, and any required LLM configuration headers.
2. Start the platform using Docker Compose:
   ```bash
   docker-compose up -d --build
   ```
3. The platform will initialize the database, create the necessary Kafka topics via an initializer container, and start all application services.

### Adding and Managing Email Accounts
To add an email account for monitoring:
1. Open the **Frontend App** at `http://localhost:8080`.
2. Navigate to the Email Manager page.
3. Add your email accounts dynamically (for example, using Gmail App Passwords). Credentials are securely stored in the PostgreSQL database and immediately picked up by the backend workers.

### Network Ports Layout
When running via `docker-compose`, the following ports are mapped to your host:
- **Frontend App**: `http://localhost:8080`
- **Main REST API**: `http://localhost:3000`
- **Logger API**: `http://localhost:3001`
- **PostgreSQL**: `5433`
- **Redis**: `16379`
- **Kafka**: `19092`

## Key Features

- **Email Monitoring**: Actively tracks and processes unread (and targetted sent) emails for Gmail accounts dynamically loaded from the PostgreSQL database—all manageable via the UI.
- **AI-Assisted Email Filtering & URL Extraction**: Parses incoming emails using `elsai-model` to reliably identify real-estate content and extract valid property URLs.
- **Automated Property Scraping & Regex Extraction**: Gracefully handles real estate platforms (e.g., magicbricks, SquareYards, Housing.com) to extract raw page text, which is then parsed using regular expressions on the NestJS backend to retrieve clean datasets containing BHK, bathrooms, and exact pricing.
- **Dashboard & Reporting**: User interface capabilities to observe scraping results globally or per user, and generate or download structured daily status reports.

## Project Structure

```text
.
├── apps/
│   ├── api/             # NestJS Primary Backend
│   └── logger/          # NestJS Logging Microservice
├── frontend/            # React/Vite web application
├── libs/                # Shared internal libraries/modules
├── python/              # Python application logic (Email Monitor, Extractor, LLM)
├── scripts/             # Infrastructure scripts (e.g. init.sql for Postgres)
├── docker-compose.yml   # Full system orchestration
└── package.json         # Root package manager configuration
```
## Mermaid Link
[Click Here](https://mermaid.live/view#pako:eNrVWt2O28YVfpUBjRRrhCuvRGml1UUArSSvFUsrRuR660TFYkQOJXYpjjoztLMxDOQiyFWCBoXRor3pVZ-hvc6j-AXSR-iZGf5JK3t1EaAMYUDkcM7PnL_vHK7fGB71idE1lgxvVsgdzON5jOD65BP0_t23_69_uQ7O1fnFrGc_66KnjMaCxH511OPJQlvt6fCrufHff_71X7_8588oVxT1o5DEAqGf_43QjGBPoPqZfHgRCiJ_XRxGr8PY7zsOetWcG3_QbOV1NQKOmuZqNJ_HD6gzjweYrxYUM59LzjOyoUxwWLcZ3RAm7tA45CKMl-r1mC75ljhnNL3pj0fDSxfEcurdElEL6bGnDnCIeFA1OhbhmqDhK3lmKY3EhOVSlOMqGlnnGA4M_nIIexV6hKOjS8LF5w6a0JgyMOXjCsbcuYy59__4uwq5S8jh2h95fhIVcjuH2HJ4zqZny0jDmw1_gjchev_tO9SH7XI9s8cWobxmQ0fGifyR-w6Jj2eua6Nh7G9oGKu4fLLRgRkSFZFPEk6Yvot2g1Ne1w4IvCYLR8Wm0gyC6wDBeTCjCyzIa3y3Fax2wlf3ZPV7_WfDm8l0ACL72FsRMKGfROSwPPBDjkaQ_2BeEdL4HvfnvafPezfa7M9xcIvTMnEId0hmP_EIk3bq05gn61KG7WTZlpfH04uL4SxzNFh4CUykr8f6dhJ6jPIPuBuIb5wXfaCG3YXcA_TV53v__V-QTblYMuJ8MYZlXSJscLiqEjsi8xJf5ZJh34kVjVFvhK4puwVrVK9A2C8VKP30Iypp-zs0XAPqZFqX7T6a9GygkD9F-T7AyUQyvFnTOBRUEigGo8F4iCBcBfVoBIs6wGgg0LSXiFVDRvA55qGH5OOWHsPfu7Ne353KcB1-LRhgIGV5LTpEoZwIhETRGpYcwRJPJIz4aIAFRinf3fwcjycyyjFbEjTG8TLBS5X8JDowOzXUDoiQNrYx48qE4zC-RflRtiTqaqBc9asWgyrnzigOGOaZRyAklUvG-K6SaTS6fDrrqUz623cKaz-ivsbdgYQcFn5D_P2Qq31-Pps-VyW5t1EYo92vGPQhAhiO0lbqPLkPh24dCF26Cb0uSoH0rhZBmO3Z2ii2cg8UIDVGeBKJPVutYisARW0vErvNYpNK_Rpo793WBAsllHwMjuyp415A1_DV0dzYAoSHu9vzLmKA2jfQ0gCM3-AQFq-ylsHOWwlYVfUFuRT6oFKv-7ik1Ww4GCkdFFgfIn4UH0_ImrI75EACyyIk-wLopqUAh3AOhaQkpMrJB2WIsBiCy7mDEr_mFcw4AACVbz_8hO6ru4UUk95ofGPPpi8kVChcg1B4FfoQF4e4tQAl67QlXamgS_eWfBcY0pYN7lRvnAk6RA7gLhQNwmSrkzfBFS7Vw8HF0CkGbmjg3mWTRXX0vBqh42M0N9RkoUaRo_7sagCj758SqBL88dyADZ-pV5ri2tEUxRgh2390tDO75pTFUFxN_5RGNAQBpfKkQvmsfCLteO3sLOQD1s56Phrp9XybdpsexcBZPnqCrlkoSO5hqOeaJOegSexkEYV8RfgHoEqRu829tE6yALgMF5J4G2JlpdhFUs2p_qtxalQz5PaNi5VR07XSQNHNMC83Mcqq6SCrd6cPaaDoWZTLA6ZVIKXJepbqlgBZnUvdVNXyH6nvmD7Pkparfvk3Yd10bNazsrJz1o5UR9uiB9K2LqZvmHkJXqeGlsuaQG3QbsGv068BfQX0It2bD-CphOwxTRVG1xuBPkWS3IVZO0uu8SRNLOiQ0oIdRbzU-cjCnu8tynz6kNbKYlD_3JleQrnnG0hn8kEh6VgN-4vxu4iv0lF-GwGmpsAKldTmbkndh6Pz-GiC4wS69L5cz1qwrI_KvnGUwdF-qRm7mgXXYWnTKLoXsOX4-zizEtzvDsV78HkP1Qex-KNUOyjjWlUb_tyX46FTHZW8CHM-IAEKsgEDriCMou4jf0FwQEwuGMzv3UeN1qlFFqZHI8q6j-rEwq3ADIDo-DUJlyvRXdDI32G6yP4EUjD1Ao-0c6b1U2w1cc602bIa_kNMNzpRS0wDEpx5Vs7Uwx180syYtutWUG88xPRWf_EpMwU9g4Kpv2i02-2Maceqd5rWQ0z9RfGpRjMlPjkr2bTtWZj4GVNrcdI-bT7ElGRTeKFpPWgFZznT02a72Sk5qnFmLfYwLbGF-c0sBqw8FMo7ZANhXjtmPgeYeWNtZt3bojyWajJZOcy8aJiAFGaeutqP5d1u3XQbpmuZUOpui-KrX2btialGDLBt-WWBvGYGYZmdDNNYstA3uoBmxDTWhEHVhEfjjWQwN8SKrAHSunDrY3Y7N-bxW6DZ4PhLStcZGaPJcmV0A5jq4CnZ-FiQQYiXDBdb4OyE9WkSC6NrNU4VD6P7xvja6DZq7U4HorvdPqmfnJ0025Zp3BndY6tV6zSarc5pq908adfrnbem8Y0Se1I7O23Xm1ar2a53Go1W3TSIL7_qT_R_EfBoHIRL4-3_AGyTjto)

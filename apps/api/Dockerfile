FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY apps/api ./apps/api
COPY libs ./libs

RUN npx nest build api

# --- Runner (Debian-slim for Playwright/Chromium compatibility) ---
FROM node:20-slim AS runner

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright

RUN groupadd -r nestjs && useradd -r -g nestjs nestjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN npx playwright install --with-deps chromium \
    && chown -R nestjs:nestjs /app/.playwright

USER nestjs

EXPOSE 3000

CMD ["node", "dist/apps/api/main"]

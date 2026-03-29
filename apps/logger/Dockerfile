FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY apps/logger ./apps/logger
COPY libs ./libs

RUN npx nest build logger

# --- Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY apps/logger/public ./public

USER nestjs

EXPOSE 3001

CMD ["node", "dist/apps/logger/main"]

# Base stage
FROM node:22-alpine AS base

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Development stage
FROM base AS development

# Install build deps for native modules
RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile && pnpm rebuild better-sqlite3

COPY . .

ENV NODE_ENV=development
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm", "dev"]

# Build stage
FROM base AS builder

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies (rebuilds native modules for this platform)
RUN pnpm install --frozen-lockfile --prod

# Copy built files and migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations
COPY --from=builder /app/drizzle.config.ts ./

# Create data directory
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/metrics.db

EXPOSE 8080

CMD ["node", "dist/index.js"]

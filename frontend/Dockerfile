# =============================================================================
# GPU Watchdog - Frontend UI
# =============================================================================
# Multi-stage Dockerfile supporting both development and production
#
# Development (with docker-compose):
#   docker compose up frontend
#
# Production:
#   docker build --target production -t gpu-watchdog-ui:latest .
#   docker run -p 80:80 gpu-watchdog-ui:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Base stage - shared dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# -----------------------------------------------------------------------------
# Development stage - with hot reload
# -----------------------------------------------------------------------------
FROM base AS development

# Install all dependencies (including devDependencies)
RUN pnpm install

# Copy source
COPY . .

EXPOSE 3000

# Start dev server with hot reload
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# -----------------------------------------------------------------------------
# Build stage - compile for production
# -----------------------------------------------------------------------------
FROM base AS builder

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build args for environment variables at build time
ARG VITE_GPU_ENDPOINTS=""
ARG VITE_SLURM_ENDPOINT=""

# Build the app
RUN pnpm build

# -----------------------------------------------------------------------------
# Production stage - serve static files
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ==============================================================================
# ATHENA — OFFICIAL PRODUCTION MULTI-STAGE DOCKERFILE
# ==============================================================================
# Stage 1: Build stage (installs dependencies, compiles TypeScript & Vite bundle)
# Stage 2: Production runner stage (minimal runtime, non-root user, healthcheck)
# ==============================================================================

# --- Stage 1: Builder ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency manifests
COPY package.json ./

# Install dependencies for production build
RUN npm install --no-audit

# Copy application source code and static assets
COPY . .

# Execute production build (Vite static bundle + esbuild server.cjs bundle)
RUN npm run build

# --- Stage 2: Production Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

# Set production environment variables and safety defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV ATHENA_NEWS_CORE_V2_SYNC_ENABLED=true
ENV ATHENA_LEGACY_WRITERS_ENABLED=false
ENV ATHENA_POSITION_ALERTS_ENABLED=false
ENV ATHENA_POSITION_ALERTS_KILL_SWITCH=true
ENV ATHENA_POSITION_ALERTS_LIVE_CONFIRMED=false

# Create unprivileged system group and user
RUN addgroup -S athena && adduser -S athena -G athena

# Copy package manifest, node_modules, and compiled dist bundle from builder
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create empty runtime data directory for volume mounting
RUN mkdir -p /app/data && chown -R athena:athena /app/data /app/dist

# Switch to non-root execution context
USER athena

# Expose server HTTP port
EXPOSE 3000

# Mount persistent data volume for `./data` store preservation
VOLUME ["/app/data"]

# Define container healthcheck against Express News V5 health endpoint (/api/v5/news/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v5/news/health || exit 1

# Production startup entrypoint
CMD ["npm", "run", "start"]

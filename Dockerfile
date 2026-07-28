# ═══════════════════════════════════════════════════════════════════
# CBT Teman Sekolah — API Dockerfile (Multi-stage build)
# ═══════════════════════════════════════════════════════════════════
# Build: docker build -t cbt-api .
# Run:   docker run -p 5003:5003 --env-file .env cbt-api

# ─── Stage 1: Install dependencies ───────────────────────────────
FROM node:20-alpine AS deps

RUN npm install -g pnpm@8.15.9

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@8.15.9

WORKDIR /app

# Copy dependencies from stage 1 (pnpm hoists to root node_modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package first
WORKDIR /app/packages/shared
RUN pnpm build 2>/dev/null || true

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# ─── Stage 3: Production image ───────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm@8.15.9

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy workspace config for production install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist 2>/dev/null || true
COPY --from=builder /app/packages/shared/src ./packages/shared/src

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5003/health || exit 1

# Switch to non-root user
USER nestjs

# Expose API port
EXPOSE 5003

# Set production environment
ENV NODE_ENV=production
ENV PORT=5003

# Start the application
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

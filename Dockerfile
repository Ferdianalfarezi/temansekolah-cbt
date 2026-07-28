# ═══════════════════════════════════════════════════════════════════
# CBT Teman Sekolah — API Dockerfile
# ═══════════════════════════════════════════════════════════════════

# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@8.15.9

WORKDIR /app

# Copy workspace manifests and lockfile first (for layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies (dev included — needed for nest CLI + tsc)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared package first
RUN pnpm --filter @cbt/shared build

# Build API (use npx to find nest from hoisted node_modules)
WORKDIR /app/apps/api
RUN npx nest build

# ─── Stage 2: Production image ───────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm@8.15.9

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy workspace config for production install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production-only dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
# Copy migrations so the built app can run them at startup
COPY --from=builder /app/apps/api/src/drizzle/migrations ./apps/api/dist/drizzle/migrations

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5003/health || exit 1

USER nestjs

EXPOSE 5003

ENV NODE_ENV=production
ENV PORT=5003

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

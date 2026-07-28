# ═══════════════════════════════════════════════════════════════════
# CBT Teman Sekolah — API Dockerfile
# ═══════════════════════════════════════════════════════════════════

# ─── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g pnpm@8.15.9

WORKDIR /app

# Copy workspace manifests first (layer cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install ALL dependencies (dev included — needed for nest CLI + tsc)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared package first, then API
RUN pnpm --filter @cbt/shared build
WORKDIR /app/apps/api
RUN npx nest build

# ─── Stage 2: Production image ───────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g pnpm@8.15.9

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Copy workspace manifests (without packages/shared — we'll handle it manually)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/

# Temporarily add shared package.json so pnpm workspace resolves
COPY packages/shared/package.json ./packages/shared/

# Install prod dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built API output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy migrations for startup migration runner
COPY --from=builder /app/apps/api/src/drizzle/migrations ./apps/api/dist/drizzle/migrations

# Place the built shared dist directly into node_modules so require('@cbt/shared') works
# This bypasses the workspace symlink resolution issue with CJS require + exports map
RUN mkdir -p ./node_modules/@cbt/shared
COPY --from=builder /app/packages/shared/package.json ./node_modules/@cbt/shared/package.json
COPY --from=builder /app/packages/shared/dist ./node_modules/@cbt/shared/dist

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5003/health || exit 1

USER nestjs

EXPOSE 5003

ENV NODE_ENV=production
ENV PORT=5003

WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

# ─── Stage 1: install dependencies ──────────────────────────────────────────
# node:20-slim is Debian-based — avoids Alpine/musl incompatibilities
# with native modules (bcrypt, etc.)
FROM node:20-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
# Fallback to npm install if lock file is missing
RUN npm ci --frozen-lockfile || npm install


# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Hard-fail if standalone output was not generated
RUN test -f .next/standalone/server.js || \
    (echo "ERROR: .next/standalone/server.js not found. Make sure next.config.ts has output:'standalone'" && exit 1)


# ─── Stage 3: production runner ──────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy standalone build (everything needed to run Next.js)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# ─── Healthcheck ─────────────────────────────────────────────────────────────
# Coolify overrides interval to ~5s regardless of Dockerfile settings.
# Using --retries=10 gives the app ~50s to become healthy.
# /api/health always returns 200 {"status":"ok"}.
HEALTHCHECK \
  --interval=5s \
  --timeout=5s \
  --start-period=30s \
  --retries=10 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

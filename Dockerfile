# ─── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:20-slim AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile || npm install --prefer-offline


# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Verify the build output exists
RUN test -d .next/server || \
    (echo "ERROR: .next/server not found — build failed" && exit 1)


# ─── Stage 3: production runner ──────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy everything needed for `next start`
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next           ./.next
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules    ./node_modules
COPY                --chown=nextjs:nodejs package.json         ./

USER nextjs

EXPOSE 3000

# ─── Healthcheck ─────────────────────────────────────────────────────────────
# --start-period=120s: gives Next.js up to 2 min to boot on slow VPS hardware.
# --retries=12 at 5s each = 60s of retries after start-period.
HEALTHCHECK \
  --interval=5s \
  --timeout=5s \
  --start-period=120s \
  --retries=12 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["./node_modules/.bin/next", "start", "--port", "3000"]

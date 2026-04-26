# ─── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps

# bcrypt requires native compilation tools
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile


# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ─── Stage 3: production runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for the healthcheck (wget has limitations in Alpine)
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Port 3000 — Coolify's Traefik handles 80/443 → 3000 externally.
# Set "Port" to 3000 in the Coolify resource settings.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# ─── Healthcheck ─────────────────────────────────────────────────────────────
# Uses curl -f (fails on HTTP 4xx/5xx) against /api/health which returns 200.
# --start-period=60s gives Next.js time to boot before Coolify checks begin.
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=60s \
  --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

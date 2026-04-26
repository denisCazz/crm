# ─── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:20-alpine AS deps

# bcrypt requires native compilation
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile


# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ─── Stage 3: production runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js respects PORT — Coolify maps external 80/443 → this port via Traefik.
# Set PORT=80 so the container listens directly on 80.
ENV PORT=80
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy the standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 80

# ─── Healthcheck ─────────────────────────────────────────────────────────────
# /api/health always returns 200 { status: "ok" }
# --start-period gives Next.js time to boot before checks begin
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=40s \
  --retries=3 \
  CMD wget -qO- http://localhost:80/api/health | grep -q '"ok"' || exit 1

CMD ["node", "server.js"]

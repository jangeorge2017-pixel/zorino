# Dockerfile for ZORINO Platform
#
# Next.js 16 requires Node >= 20.9. The previous image pinned node:18, which
# cannot run `next build` at all — that was the "RUN npm run build ... exit code 1".
#
# Two build-breaking traps are avoided below:
#   1. `npm ci` must install devDependencies (typescript, @tailwindcss/postcss).
#      A NODE_ENV=production injected into the build makes npm omit them.
#   2. No `.next/standalone` is produced (output is not set to standalone), so
#      the runner copies the full `.next` and starts with `next start`.
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --include=dev keeps the build toolchain present regardless of NODE_ENV.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOME=/app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Runtime dependencies only, plus the compiled output and static assets.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

USER nextjs

EXPOSE 3000

# Render injects PORT/HOSTNAME at runtime; these are local-dev defaults only.
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Invoke next directly: npm is not usable as the non-root user without a cache dir.
CMD ["node", "node_modules/next/dist/bin/next", "start"]

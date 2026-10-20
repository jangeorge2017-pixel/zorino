# syntax=docker/dockerfile:1
# Dockerfile for ZORINO Platform — Render Docker deploy.
#
# Render cannot switch a service from Docker to the native runtime, so this
# file is the deploy path. Optimised for Render's free tier:
#   * devDependencies are installed once (cached layer) and pruned in place
#     afterwards, instead of running a second `npm ci` in the runtime stage.
#   * the build context is trimmed by .dockerignore (node_modules, .next, the
#     ~700MB backup archive, generated assets in scripts/).
#
# Node 20.9+ is required by Next.js 16; the previous node:18 image could not run
# `next build` at all, which produced "RUN npm run build ... exit code 1".
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- dependencies ---------------------------------------------------------
# libc6-compat keeps Next's native bits (sharp) working on musl.
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --include=dev is mandatory: typescript, @types/* and @tailwindcss/postcss are
# devDependencies and `next build` aborts without them.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ---- build ----------------------------------------------------------------
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=2048 \
    CI=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Type-checking during the build is disabled in next.config.ts
# (typescript.ignoreBuildErrors) to stay under the free-tier memory ceiling.
RUN npm run build

# Drop devDependencies in place — cheaper than a second full install.
RUN npm prune --omit=dev

# ---- runtime --------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOME=/app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

USER nextjs

EXPOSE 3000

# Render injects PORT/HOSTNAME at runtime; these are local-dev defaults only.
ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Invoke next directly — npm has no writable cache dir for the nextjs user.
CMD ["node", "node_modules/next/dist/bin/next", "start"]

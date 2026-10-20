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

# Render injects the service's environment variables as Docker build args, but
# Docker ignores them unless each one is declared with ARG in the stage that
# needs it. NEXT_PUBLIC_* values are inlined into .next at BUILD time, so if
# they are missing here they are frozen as `undefined` — every Supabase client
# then returns null and the site renders 0 products/stores/coupons.
#
# The two values below are Supabase's PUBLIC project URL and its publishable
# key (`sb_publishable_…`). Both ship to every browser in the JS bundle anyway,
# so baking them here is equivalent to the previous Vercel build; they are
# declared as ARG defaults rather than fixed ENV lines so a build arg supplied
# by Render still takes precedence over the baked value.
#
# Secrets are deliberately absent: SUPABASE_SERVICE_ROLE_KEY and provider API
# keys are runtime-only and must never be written into a Dockerfile, since they
# would persist in the image layers and in git history.
ARG NEXT_PUBLIC_SUPABASE_URL="https://trgzpvpzzfldtouikitc.supabase.co"
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_9EbS4IP6UhTImBvGcCYVCw_cOmu08DX"
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CONTACT_EMAIL_DOMAIN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CONTACT_EMAIL_DOMAIN=$NEXT_PUBLIC_CONTACT_EMAIL_DOMAIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Visible in the Render build log — confirms whether Render actually injected
# the build args. If this prints <EMPTY>, the variable is missing from the
# service's Environment settings (env vars → build args only apply to vars that
# already exist on the service).
RUN echo "build-arg NEXT_PUBLIC_SUPABASE_URL      = ${NEXT_PUBLIC_SUPABASE_URL:-<EMPTY>}" && \
    echo "build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY = ${NEXT_PUBLIC_SUPABASE_ANON_KEY:+<set>}${NEXT_PUBLIC_SUPABASE_ANON_KEY:-<EMPTY>}" && \
    echo "build-arg NEXT_PUBLIC_SITE_URL          = ${NEXT_PUBLIC_SITE_URL:-<EMPTY>}"

# Should never trip now that defaults are baked, but still catches an explicit
# empty build arg (`--build-arg NEXT_PUBLIC_SUPABASE_URL=`) from Render.
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" || { \
      echo "ERROR: NEXT_PUBLIC_SUPABASE_URL resolved to an empty string at build time."; \
      echo "An empty build arg is overriding the baked default - check Environment settings."; \
      exit 1; \
    }

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

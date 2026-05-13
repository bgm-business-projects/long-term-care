# syntax=docker/dockerfile:1.7
# Nuxt 4 + Nitro node-server preset

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat bash
# 用 npm 直接裝 pnpm（避免 corepack 在某些 node 版本需 --force-cache-update）
RUN npm install -g --no-audit --no-fund pnpm@10.18.2
WORKDIR /app

# ── deps stage：安裝完整 dependencies（含 dev，build 用） ──
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── builder stage：build Nuxt → node-server output ──
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production
RUN pnpm build

# ── runner stage：.output（self-contained server）+ migration 用的小型 deps ──
FROM base AS runner
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Nuxt 的 .output/server 本身已內含 server 需要的 deps（Nitro 打包）
COPY --from=builder /app/.output ./.output

# 額外只裝 migration 需要的 tooling（避免完整 pnpm install 的副作用）
RUN npm install -g --no-audit --no-fund tsx@4.20.6 \
 && npm install --omit=dev --no-save --no-audit --no-fund \
    drizzle-orm@0.45.1 \
    postgres@3.4.7
# Migration 用的檔案
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder /app/server/infrastructure/db ./server/infrastructure/db
COPY --from=builder /app/server/domain ./server/domain
COPY --from=builder /app/server/shared ./server/shared

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# 簡易 healthcheck：HTTP 200 即可
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]

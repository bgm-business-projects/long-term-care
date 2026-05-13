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

# ── runner stage：.output + 完整 node_modules（給 migration/seed scripts 用） ──
FROM base AS runner
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Nuxt 的 .output/server 已內含 server 需要的 deps（Nitro 打包）
COPY --from=builder /app/.output ./.output

# tsx 全域裝（給 entrypoint 與 seed 用）
RUN npm install -g --no-audit --no-fund tsx@4.20.6

# 完整安裝 deps，scripts/seed*.ts 才能 import 到 @noble/hashes / @better-auth/utils 等
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Migration / seed 用的檔案
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server ./server

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# 簡易 healthcheck：HTTP 200 即可
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]

#!/bin/sh
set -e

# 啟動時自動跑 migration（可用 SKIP_MIGRATE=1 跳過）
if [ "$SKIP_MIGRATE" != "1" ]; then
  if [ -z "$NUXT_DATABASE_URL" ]; then
    echo "[entrypoint] NUXT_DATABASE_URL 未設定，跳過 migration"
  else
    echo "[entrypoint] 執行 drizzle migration..."
    tsx scripts/migrate.ts || {
      echo "[entrypoint] migration 失敗（可能是首次部署或已套用），請檢查 log"
      [ "$MIGRATE_FAIL_FAST" = "1" ] && exit 1
    }
  fi
fi

exec "$@"

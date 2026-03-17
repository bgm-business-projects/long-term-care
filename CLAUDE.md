# CLAUDE.md

## Database Schema 同步 SOP

當修改 `server/infrastructure/db/schema.ts` 後，需執行以下步驟將變更同步到資料庫：

1. **產生 migration SQL**
   ```bash
   npm run db:generate
   ```
   這會比對 schema 與上次 snapshot 的差異，在 `drizzle/` 目錄下產生新的 `.sql` migration 檔案。

2. **檢查產生的 SQL**
   確認 `drizzle/` 下新產生的 `.sql` 內容正確。

3. **執行 migration**
   ```bash
   npm run db:migrate
   ```
   這會執行所有尚未套用的 migration，並記錄到 `drizzle.__drizzle_migrations` 表。

注意事項：
- 不使用 `drizzle-kit push`，一律透過 migration 檔案管理 schema 變更
- Migration 檔案需提交至 git，確保所有環境一致
- Migration script 位於 `scripts/migrate.ts`，透過 `--env-file=.env` 讀取 `NUXT_DATABASE_URL`

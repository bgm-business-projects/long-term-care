---
name: manus-dockerize
description: 將 Manus 平台專案遷移為 docker-compose 自託管部署。當使用者提到要從 Manus 遷移、Docker 部署、或去除 Manus/Forge 依賴時自動觸發。
argument-hint: "[project-path]"
disable-model-invocation: true
---

# Manus → Docker-Compose 遷移 Skill

將原本部署在 Manus 平台的 Web 專案遷移為 docker-compose 自託管部署。

## 遷移範圍

### 1. 認證系統替換
- **移除**: Manus OAuth (sdk.ts, oauth.ts, cookies.ts)
- **替換為**: [BetterAuth](https://better-auth.com/)
  - Email/Password 登入
  - Google OAuth（可選，透過系統設定頁面配置）
  - 使用 Drizzle adapter 對接現有 DB
  - `advanced.database.generateId: false` 讓 DB 用 auto-increment
  - `toNodeHandler(auth)` 必須掛載在 Express body parser **之前**
  - users 表需新增: `emailVerified`, `image`, `banned`, `banReason`, `banExpires`
  - 新增表: `sessions`, `accounts`, `verifications`（全用 int auto-increment ID）
  - 前端需建立 Login 頁面 + BetterAuth client (`createAuthClient`)

### 2. Forge API 服務替換

| Manus Forge 服務 | 替換方案 |
|---|---|
| Storage (S3 proxy) | MinIO 容器 + `@aws-sdk/client-s3` 直連 |
| LLM (chat completions) | 直接呼叫 OpenAI / Gemini API（從 DB 設定讀取 key） |
| Google Maps proxy | 直接呼叫 Google Maps API（從 DB 設定讀取 key） |
| Image Generation | 移除（未使用） |
| Voice Transcription | 移除（未使用） |
| Data API | 移除（未使用） |
| Notification | 移除（Manus 專用） |

### 3. 系統設定（新功能）
- 新增 `systemSettings` 表 (key-value store)
- 設定項: `llm.provider`, `llm.apiKey`, `llm.model`, `google.mapsApiKey`, `google.oauthClientId`, `google.oauthClientSecret`
- 建立 Settings tRPC router (getAll, update, getPublic)
- 前端 Settings 頁面新增「系統設定」tab（僅 admin 可見）

### 4. Docker 配置
- **Dockerfile**: multi-stage build (node:20-alpine)
  - Stage 1: `pnpm install` + `pnpm build`
  - Stage 2: 複製 dist + node_modules + drizzle，CMD 先跑 migration 再啟動
- **docker-compose.yml**: 三個服務
  - `app`: Node.js (port 3000)
  - `mysql`: MySQL 8.0 (不對外開 port)
  - `minio`: MinIO S3 (不對外開 port)
- **`.env.example`**: 環境變數模板
- **`.dockerignore`**: 排除 node_modules, dist, .env, .git 等

### 5. Seed 資料
- Admin 帳號（透過 BetterAuth API 建立，密碼正確 hash）
- 服務類別、治療師、患者、商品等初始資料
- 冪等設計：已有資料就跳過

## 實作順序

```
1. Schema 變更（users 表 + BetterAuth 表 + systemSettings 表）
2. System Settings 服務
3. BetterAuth 認證（最大改動）
4. Storage → MinIO（可並行）
5. LLM → 直接 API（可並行）
6. Google Maps → 直接 API（可並行）
7. 移除 Manus 程式碼
8. Settings 頁面新增系統設定 Tab
9. Docker 配置
10. Seed + 清理 + 驗證
```

## 注意事項

- Express `app.all("/api/auth/*", toNodeHandler(auth))` 必須在 `express.json()` **之前**，否則 BetterAuth 讀不到 request body
- BetterAuth admin plugin 需要 `banned`, `banReason`, `banExpires` 欄位
- `generateId: false` 放在 `advanced.database` 裡（不是 `advanced` 頂層）
- Drizzle migration SQL 用 `--> statement-breakpoint` 分隔語句
- Migration 中要 DROP 舊的 Manus 欄位（如 `openId`, `loginMethod`）避免 NOT NULL 衝突
- 前端登入成功後用 `window.location.href = "/"` 做完整重載（不是 SPA navigate），確保 cookie 被讀取
- Vite config 要移除 `vite-plugin-manus-runtime` 和 debug collector
- `index.html` 要移除 Manus analytics script

## 檔案異動總覽

| 操作 | 檔案 |
|---|---|
| **新建** | `Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore` |
| **新建** | `server/_core/auth.ts`, `server/_core/settings.ts`, `server/_core/seed.ts` |
| **新建** | `server/routers/settings.ts` |
| **新建** | `client/src/pages/Login.tsx`, `client/src/lib/auth-client.ts` |
| **改寫** | `server/_core/env.ts`, `server/_core/context.ts`, `server/_core/index.ts` |
| **改寫** | `server/_core/llm.ts`, `server/_core/map.ts`, `server/storage.ts` |
| **修改** | `drizzle/schema.ts`, `server/routers.ts`, `server/db.ts` |
| **修改** | `client/src/App.tsx`, `client/src/pages/Settings.tsx` |
| **修改** | `client/src/_core/hooks/useAuth.ts`, `client/src/components/DashboardLayout.tsx` |
| **修改** | `vite.config.ts`, `package.json`, `shared/const.ts` |
| **刪除** | `server/_core/sdk.ts`, `server/_core/oauth.ts`, `server/_core/cookies.ts` |
| **刪除** | `server/_core/notification.ts`, `server/_core/imageGeneration.ts` |
| **刪除** | `server/_core/voiceTranscription.ts`, `server/_core/dataApi.ts` |

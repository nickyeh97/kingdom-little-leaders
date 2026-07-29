# 開發指南

> 開發、測試、部署與第三方服務設定的完整說明。專案概觀請見根目錄 [`README.md`](../README.md)。

## 開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 專案的 URL 與 anon key
npm run dev                  # 開發伺服器 http://localhost:5173
npm run build                # 型別檢查 + production build（含 PWA）
npm test                     # 單元與邊際測試（Vitest）
npm run test:watch           # 開發時監看模式
```

- 分支慣例：功能開發在 `claude/*` 或 feature 分支進行，不直接 push `main`；merge 進 `main` 即自動部署。
- 聚會日、截止時間等日程設定集中於 `src/lib/config.ts`。

## 測試

- 框架：Vitest ＋ Vue Test Utils（元件）＋ jsdom
- 測試位置：`src/**/__tests__/*.test.ts`，與被測程式碼相鄰
- 涵蓋重點：聚會日/截止日日期邏輯（含跨月、跨年、截止瞬間等邊際）、
  標籤式權限與審核制（`can()` 嚴格逐標籤）、路由守衛、Tabbar 角色顯示、
  表情選項守則檢核、CSV 匯出跳脫
- CI：push / PR 會自動執行 build 與測試（`.github/workflows/ci.yml`）
- 慣例：**新增功能時一併新增對應測試**；資料層權限以 Supabase RLS 為準，
  端對端流程測試（Playwright）待功能穩定後導入

## 後端初始化（Supabase，一次性）

1. 到 [supabase.com](https://supabase.com) 建立免費專案（區域選 Tokyo 較近）。
2. SQL Editor 依序執行 `supabase/schema.sql` → `supabase/rls.sql` →（開發環境）`supabase/seed.sql`。
   - 既有資料庫做增量升級時，改為依日期順序執行 `supabase/migrations/` 內的檔案。
3. Authentication → Users → 建立自己的帳號，並在 `profiles` 表把 `roles` 改為 `{admin,teacher,parent}`、`approved` 設為 `true`（第一位管理者需手動核准）。
4. Project Settings → API 取得 URL 與 anon key，填入 `.env.local`。
5. 建議：Authentication → Sign In / Providers → Email 關閉「Confirm email」（教會內部使用，省去收確認信）。

## 部署（Vercel，一次性設定約 5 分鐘）

1. 到 [vercel.com](https://vercel.com) 以 GitHub 帳號登入 → **Add New → Project** → 選 `kingdom-little-leaders` repo（首次需授權 Vercel 存取此 repo）。
2. Framework 會自動偵測為 **Vite**，Build 設定不用改（`vercel.json` 已含 SPA 路由設定）。
3. 展開 **Environment Variables**，加入兩個變數（值同 `.env.local`）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 按 **Deploy**，完成後會得到 `https://<專案名>.vercel.app` 網址。
5. 回 Supabase → **Authentication → URL Configuration**，把 **Site URL** 改為上述網址。
6. 手機瀏覽器開啟網址 → 分享選單 → **加入主畫面**，即可像 App 一樣使用（PWA）。

之後每次 push `main`，Vercel 會自動重新部署；PR 也會有預覽網址。

## 第三方登入設定

### Google（一次性，約 10 分鐘）

1. 到 [console.cloud.google.com](https://console.cloud.google.com) 建立專案（名稱隨意，如 `kingdom-little-leaders`）。
2. **Google Auth Platform →「建立品牌」**（舊版介面為 OAuth consent screen）：應用程式名稱與支援信箱填妥，目標對象選 **External**。
3. **「用戶端」→ 建立用戶端**（舊版為 Credentials → OAuth client ID）：
   - Application type：**Web application**
   - Authorized JavaScript origins：`https://kingdom-little-leaders.vercel.app` 與 `http://localhost:5173`
   - Authorized redirect URIs：`https://bazvzaqetvjpnanabkox.supabase.co/auth/v1/callback`
4. 複製產生的 **Client ID** 與 **Client Secret**。
5. Supabase → **Authentication → Sign In / Providers → Google**：啟用並貼上 Client ID / Secret。
6. Supabase → **Authentication → URL Configuration**：Site URL 為正式網址；**Redirect URLs** 加入 `http://localhost:5173`（本機開發用）。

完成後登入頁的「使用 Google 登入」即可運作；Google 首次登入視同註冊，預設為家長身分、待管理者審核。

### LINE / Apple（未實作）

規劃中；LINE 需透過 Supabase Edge Function 自訂 OIDC 接入，與 Google Sheet 自動同步一併等教會授權後實作。

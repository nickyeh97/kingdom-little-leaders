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

## 測試資料庫（測完整流程，不碰正式環境）

要從「第 0 次服事」一路測到「小領袖」，又不想動到正式資料，就開一個**測試用的 Supabase 專案**，
平台與遊戲都在自己電腦上跑、連到它。正式網站、正式資料庫完全不受影響。

**一次性準備（約 15 分鐘）**

1. Supabase 建第二個免費專案（例：`kll-test`；免費方案可有兩個專案。7 天沒用會暫停，回後台按 Restore 即可）。
2. 測試專案的 SQL Editor 依序執行：`supabase/schema.sql` → `supabase/rls.sql` →
   `supabase/migrations/` 裡 **2026-08-11 以後**的檔案（依檔名順序）→
   `supabase/test/mark_as_test_database.sql`（**只在測試專案跑**，它是測試工具的「這是測試庫」標記）。
   - 2026-08-10 以前的 migration 已經合進 `schema.sql`／`rls.sql`，**不要再跑**（會刪掉一條權限規則、加回已廢棄的欄位）；
     2026-08-11 以後的還沒合進去（例如 `class_topics`、`child_service_permissions` 兩張表只在 migration 裡）
   - 2026-11-01 用這個順序建 `kll-spirits` 測試專案，欄位、權限規則、函式、觸發器四類都和正式資料庫逐項比對一致
   - 服事項目：舊 migration 會放進 09 月的六個舊名稱；測試庫請改成正式環境目前的七項（快轉工具會自動補上）
3. 測試專案 → Authentication：
   - **URL Configuration → Site URL** 改成 `http://localhost:5173`，**Redirect URLs** 加入 `http://<電腦的區網 IP>:5173`。
     新專案預設的 Site URL 是 `http://localhost:3000`，剛好是本機遊戲的埠號——驗證信、重設密碼信的連結會跳到遊戲
     （2026-11-01 實際遇到；驗證其實已經成功，回平台用 Email 登入即可）。
   - **Sign In / Providers → Email**：關掉 **Confirm email**（測試帳號不用收驗證信）。
4. 平台：根目錄新增 `.env.staging.local`（已被 `.gitignore` 排除），填測試專案的值：
   ```
   VITE_SUPABASE_URL=https://<測試專案>.supabase.co
   VITE_SUPABASE_ANON_KEY=<測試專案的 anon key>
   VITE_SPIRIT_GAME_URL=http://<電腦的區網 IP>:3000
   ```
5. 遊戲 repo：照該 repo `docs/DEVELOPMENT.md`「測試資料庫」放 `supabase.local.json`、建置、`npx --yes serve Builds/Web`。

**每次測試**

```bash
npm run dev:staging     # 平台連測試資料庫；手機連同一個 Wi-Fi 開 http://<電腦 IP>:5173
```

- 畫面最上方要看到黃色的「🧪 測試資料庫：jyfog….supabase.co」。**沒看到就是連到正式資料庫**（多半是跑成 `npm run dev`，
  或檔名不是 `.env.staging.local`——Mac 可能偷偷加了 `.txt`），先停下來檢查。
- 測試模式讀到的仍是正式資料庫時，平台會**直接拒絕連線**（頂端紅條「已停止連線」）。常見原因：
  `.env.staging.local` 不在 repo 根目錄、檔名不對，或**建立／修改檔案後沒有重開** `npm run dev:staging`（Vite 只在啟動時讀設定）。
  用 `ls -a | grep env` 看檔名、`env | grep VITE_` 確認終端機沒有另外設定同名變數（它會蓋過檔案）。
- 測試站**只用 Email 登入／註冊，不要按「使用 Google 登入」**：測試專案沒開 Google；
  若平台其實連到正式資料庫，Google 登入完會被導回正式網站（正式專案只允許 `localhost:5173` 回到本機，用區網 IP 開的不在名單內）。

1. 在測試平台用 Email 註冊一個測試家長（例：`test-parent@example.com`）。
2. 測試專案的 SQL Editor 貼上 `supabase/test/spirit_beast_testkit.sql`，改開頭三個值後 Run：
   它會建假名孩子「測試小明」（兒童班）、綁定測試家長、把服事次數直接設成 N。
3. 到「我的 → 小領袖靈獸 → 去看靈獸」按一次「＋1 服事」，就看到那一次的進化：

| 要看的畫面 | N | 再按幾次 ＋1 |
| --- | --- | --- |
| 第一次相遇（選靈獸） | 0，`reset_beast = true` | 不用 |
| 初生 → 成長 | 3 | 1 |
| 成長 → 茁壯 | 11 | 1 |
| 茁壯 → 小領袖 | 23 | 1 |
| 真的從頭按到小領袖 | 0，`reset_beast = true` | 24（約 20 分鐘） |

- 測試工具有兩道防呆：找不到 `zz_test_database` 標記、或孩子超過 20 位（像正式資料庫）就拒絕執行。
- 正式資料庫**不要**執行 `supabase/test/` 底下任何檔案。

## 部署（Vercel，一次性設定約 5 分鐘）

1. 到 [vercel.com](https://vercel.com) 以 GitHub 帳號登入 → **Add New → Project** → 選 `kingdom-little-leaders` repo（首次需授權 Vercel 存取此 repo）。
2. Framework 會自動偵測為 **Vite**，Build 設定不用改（`vercel.json` 已含 SPA 路由設定）。
3. 展開 **Environment Variables**，加入兩個變數（值同 `.env.local`）：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SPIRIT_GAME_URL`（選填）：「小領袖靈獸」遊戲的部署網址；未設定時「我的」不顯示遊戲入口
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

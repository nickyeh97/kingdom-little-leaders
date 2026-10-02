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

### LINE 登入設定（v15 #1｜等組長建 LINE 頻道）

平台端程式**已完成**，缺的是外部設定。做完下面 A～C 三段，登入頁的「使用 LINE 登入」
與「我的 → 登入方式 → 綁定」就會運作。

> **定位**：LINE 是**追加登入方式**，不是註冊管道。已有帳號的人綁定後可用 LINE 登入同一個帳號；
> 新人仍走 Email / Google 註冊。理由見 `src/lib/lineIdentity.ts` 的檔頭說明。

#### A. 建立 LINE Provider 與 Login channel

1. 到 [developers.line.biz](https://developers.line.biz/console/) 用教會的 LINE 帳號登入。
2. **建立一個 Provider**（例：`國度領袖兒童牧區`）。
   > ⚠️ **這個 Provider 之後要拿來開 Messaging API channel（推播用）**。
   > LINE 的 userId 是 **pairwise**——**同一個 Provider 底下**的 Login channel 與 Messaging channel
   > 拿到的 userId 才會一致；分屬不同 Provider 就對不起來，日後要做推播會接不上。
   > 現在多花一分鐘設對，比之後搬家便宜太多。
3. 在該 Provider 底下 **Create a new channel → LINE Login**。
   - App types 勾 **Web app**
   - Callback URL 填 Supabase 給的那一組（下一段 B 會拿到，可先留空再回來補）
4. 記下 channel 的 **Channel ID**（＝OAuth client id）與 **Channel secret**（＝client secret）。

**email 權限不用申請**：本平台不靠 LINE 拿 email（綁定是掛在既有帳號上，email 早就有了）。
scope 只要 `openid profile` 就夠。

#### B. 在 Supabase 新增 Custom OIDC Provider

Supabase 沒有內建 LINE，但**支援自訂 OIDC provider**（Free plan 可加 3 個），
而 LINE Login v2.1 就是標準 OIDC，所以**不需要自己寫 Edge Function**
（這一點推翻了本文件先前「需透過 Edge Function 自訂 OIDC 接入」的寫法）。

1. Supabase → **Authentication → Sign In / Providers → Add provider → Custom (OIDC)**。
2. 識別字填 **`line`**（程式端用的是 `custom:line`，前綴由 Supabase 加）。
3. **Issuer URL** 填 `https://access.line.me`
   （其餘端點會自動從 `https://access.line.me/.well-known/openid-configuration` 取得）。
4. 貼上 A 步驟的 **Channel ID / Channel secret**。
5. Scopes 填 `openid profile`。
6. 複製表單上唯讀的 **Callback URL**，回到 LINE Login channel 貼進 Callback URL。

#### C. 打開手動綁定（**必做，漏了會整個不能用**）

Supabase → **Authentication → Sign In / Providers →「Enable Manual Linking」打開**。

沒開的話 `linkIdentity()` 會被伺服器直接拒絕，「我的」頁按綁定會失敗。

#### 驗證

1. 用既有的 Email 帳號登入 → 「我的 → 登入方式」應看到「LINE 登入・尚未綁定」與「綁定」鈕。
2. 按綁定 → 跳 LINE 授權 → 回到「我的」→ 狀態變「已綁定：〈你的 LINE 名稱〉」。
3. 登出，在登入頁按「使用 LINE 登入」→ 應該登入**同一個帳號**（孩子、角色標籤都在）。
4. 回「我的」按「解除」→ 狀態回到未綁定。（若那是你唯一的登入方式，按鈕會是停用狀態。）

#### 疑難排解

| 症狀 | 原因 |
| --- | --- |
| 按綁定跳錯誤，訊息提到 manual linking | C 段的 Enable Manual Linking 沒開 |
| LINE 授權後回來變成**另一個空帳號**（待審核、看不到孩子） | 走到 `signInWithOAuth` 而不是 `linkIdentity`——代表這個帳號還沒綁定過。先登出、用原帳號登入再綁定；首頁的提醒也會這樣講 |
| LINE 回 `400 invalid_request` | Callback URL 沒填或與 Supabase 給的不完全一致（含結尾斜線） |
| 「我的」看不到「登入方式」整區 | `getUserIdentities()` 失敗，多半是 provider 還沒設好；這是刻意的，設好就會出現 |

### Apple（未實作）

Supabase 內建 Apple provider，等有需求再開。

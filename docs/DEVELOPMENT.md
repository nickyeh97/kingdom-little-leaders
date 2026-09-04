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

規劃中；LINE 需透過 Supabase Edge Function 自訂 OIDC 接入，與 Google 雲端串接一併等教會授權後實作
（取得授權的步驟見下方「教會 Google 雲端串接」）。

## 教會 Google 雲端串接（Service Account，尚未實作，等金鑰）

> 目的：讓平台能**上傳／下載教會 Google 雲端的檔案**（研習會講義、簡報、教材），
> 不必再靠同工手動上傳到雲端後回平台貼連結。
>
> **這一節是「取得金鑰」的操作教學**，做完把金鑰交給維護平台的同工即可；
> 平台端的實作（Edge Function）在拿到金鑰之後才會開工。

### ⚠️ 先講三件事

1. **帳號密碼沒有用。** Google API 不接受帳號密碼登入，需要的是 **Service Account 的 JSON 金鑰**。
2. **不要把教會 Google 帳號的密碼給任何人**（包括開發者）。那組密碼能存取的遠不只兒童部資料夾。
3. **金鑰＝密碼等級的機密。** 下載後不要 email、不要 LINE、不要進版控。
   它只會給你下載**一次**，弄丟就重新產生一把、把舊的刪掉。

### Service Account 是什麼（一句話）

一個「**只為程式而生的 Google 帳號**」。它有自己的 email（長得像
`kll-drive@專案名.iam.gserviceaccount.com`），你**只把兒童部那一個資料夾分享給它**，
它就只碰得到那個資料夾——教會雲端其他東西它一概看不到。權限收得比用真人帳號乾淨得多。

### 步驟 A：建立 Service Account 並下載金鑰（約 10 分鐘）

在 [console.cloud.google.com](https://console.cloud.google.com) 操作。
**建議用教會的 Google 帳號登入**，這樣專案歸教會所有，日後人員異動不會卡住。

1. 左上角選專案。可以沿用做 Google 登入時建的那個（如 `kingdom-little-leaders`），
   或按「**新增專案**」開一個新的。
2. 搜尋列輸入 **「Service Accounts」**（服務帳戶），進入 **IAM 與管理 → 服務帳戶**。
3. 點 **「建立服務帳戶」**：
   - **服務帳戶名稱**：填 `kll-drive`（隨意，看得懂即可）
   - 帳戶 ID 會自動產生，下方會顯示完整 email，**先把它複製起來**，步驟 C 要用
   - 「授予這個服務帳戶專案存取權」這一步**可以整個跳過**（按「繼續」再按「完成」）
     ——我們不靠專案層級權限，只靠資料夾分享
4. 回到服務帳戶清單，**點剛建立的那個 email** 進入詳細頁。
5. 切到 **「金鑰」** 分頁 → **「新增金鑰」→「建立新的金鑰」**。
6. 類型選 **JSON** → 「建立」。瀏覽器會下載一個 `.json` 檔。

> **這個檔案只能下載這一次**，Google 不會再給第二份。先放在自己電腦上，別急著寄出去。

### 步驟 B：啟用 Google Drive API

1. 同一個專案裡，搜尋 **「Google Drive API」**。
2. 點進去按 **「啟用」**。

沒做這步的話，之後呼叫 API 會直接被擋。

### 步驟 C：把兒童部資料夾分享給 Service Account

**這是最關鍵的一步，也是權限收斂的重點。**

1. 用教會帳號開 [drive.google.com](https://drive.google.com)。
2. 找到（或新建）一個**只放兒童部檔案**的資料夾，例如「兒童部平台檔案」。
3. 對資料夾按右鍵 → **「共用」**。
4. 貼上步驟 A 複製的 **Service Account email**（`...iam.gserviceaccount.com`）。
5. 權限選 **「編輯者」**（要能上傳）；若只需要下載，選「檢視者」就好。
6. 送出。Google 可能會提示「這不是有效的 Google 帳戶」之類的警告，**照樣送出即可**——
   Service Account 本來就不是真人帳號。

> **只分享這一個資料夾**，不要分享整個雲端硬碟。
> 分享範圍就是平台能碰到的範圍——這是這個做法比給帳密安全的地方。

### 步驟 D：把金鑰交給平台

**不要用 email 或 LINE 傳。** 兩個安全的做法擇一：

- **（建議）由組長自己貼進 Supabase**：
  Supabase 專案 → **Edge Functions → Secrets** → 新增一組
  `GOOGLE_SERVICE_ACCOUNT_JSON`，值就是那個 JSON 檔的完整內容。
  這樣金鑰從頭到尾只有組長碰過。
- 或用有到期時間的密碼保管服務（如 1Password、Bitwarden Send）傳給維護平台的同工。

另外還要提供：**步驟 C 那個資料夾的 ID**。
開啟資料夾後看網址列 `https://drive.google.com/drive/folders/【這一段就是 ID】`，
複製那段字串即可。

### 平台端會怎麼做（拿到金鑰之後）

- 金鑰**只存在 Supabase Edge Function 的 secret**，不進版控、不進前端。
  平台前端用的是公開的 anon key，任何金鑰放進去等於對外公開。
- 由 Edge Function 代為呼叫 Drive API：上傳、列檔、產生下載連結。
- 前端只跟 Edge Function 說話，永遠拿不到金鑰。
- 權限沿用平台既有規則（只有同工能上傳，家長只能看被分享的內容）。

### 驗收：第一件要測的事

拿到金鑰後，第一步先**上傳一個測試檔案**確認能成功。

Service Account 沒有自己的雲端硬碟空間，上傳到「別人分享給它的資料夾」時，
在某些帳號型態下會出現配額相關的錯誤。若真的踩到：

- **教會有 Google Workspace**：把檔案改放**共用雲端硬碟（Shared Drive）**，
  把 Service Account 加為成員即可解決（檔案歸共用雲端硬碟所有，不佔 SA 配額）。
- **教會用的是一般 Gmail 帳號**：沒有共用雲端硬碟。
  這種情況下維持現況（同工上傳到雲端、平台外連）是比較務實的做法。

所以在開工前，請先確認一件事：**教會用的是 Google Workspace 還是一般 Gmail 帳號？**

### 出問題時

| 症狀 | 通常是 |
| --- | --- |
| `403 Google Drive API has not been used...` | 步驟 B 沒做（API 未啟用） |
| `404 File not found` | 步驟 C 沒做，或分享錯資料夾 |
| `403 Insufficient permission` | 步驟 C 權限給成「檢視者」，但要上傳 |
| `storageQuotaExceeded` | 見上方「驗收」一節 |
| 金鑰外洩 | 到 Console 的「金鑰」分頁**刪掉那把金鑰**，重新建一把；舊的立刻失效 |

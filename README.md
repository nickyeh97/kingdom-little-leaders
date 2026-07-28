# TBOJ 兒童主日學整合平台

> 「這樣，信心若沒有行為就是死的。」— 雅各書 2:17

## 開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase 專案的 URL 與 anon key
npm run dev                  # 開發伺服器 http://localhost:5173
npm run build                # 型別檢查 + production build（含 PWA）
npm test                     # 單元與邊際測試（Vitest）
npm run test:watch           # 開發時監看模式
```

### 測試

- 框架：Vitest ＋ Vue Test Utils（元件）＋ jsdom
- 測試位置：`src/**/__tests__/*.test.ts`，與被測程式碼相鄰
- 涵蓋重點：主日/截止日日期邏輯（含跨月、跨年、截止瞬間等邊際）、
  標籤式權限（`can()` 嚴格逐標籤）、路由守衛、Tabbar 角色顯示、表情選項守則檢核
- CI：push / PR 會自動執行 build 與測試（`.github/workflows/ci.yml`）
- 慣例：**新增功能時一併新增對應測試**；資料層權限以 Supabase RLS 為準，
  端對端流程測試（Playwright）待功能穩定後導入

### 後端初始化（一次性）

1. 到 [supabase.com](https://supabase.com) 建立免費專案（區域選 Tokyo 較近）。
2. SQL Editor 依序執行 `supabase/schema.sql` → `supabase/rls.sql` →（開發環境）`supabase/seed.sql`。
3. Authentication → Users → 建立自己的帳號，並在 `profiles` 表把 `role` 改為 `admin`。
4. Project Settings → API 取得 URL 與 anon key，填入 `.env.local`。


以單一 Web APP / PWA 整合兒童主日學的日常行政與「神國小領袖」文化養成：

- 📋 **出席預先統計**：家長每週勾選孩子是否出席，自動統計人數
- ✅ **現場簽到**：老師主日現場點名，取代紙本/表單
- 📖 **老師備課資源**：每週教材影音、討論問題、帶領提示、舞蹈教學影片
- 🎵 **敬拜歌單佈達**：家長主日後可預習下週歌曲與影片
- 🌱 **服事經歷卡**：記錄孩子自己的服事成長軌跡（不做排行、不做比較）
- 📢 **家長公告**：公告發布與雙向互動

本專案隸屬於 [TBOJ（The Book of James）](https://github.com/nickyeh97/TBOJ) 信仰實踐計畫。

## 技術棧

- 前端：Vue 3 + Vite + Vant（mobile-first PWA）
- 後端：Supabase（Postgres + Auth + Row Level Security）
- 影音：外連 / 嵌入 YouTube

## 必讀文件

| 文件 | 說明 |
| --- | --- |
| [`docs/DESIGN_PRINCIPLES.md`](docs/DESIGN_PRINCIPLES.md) | **最高守則**——任何設計必須先通過檢核 |
| [`docs/SUNDAY_SCHOOL_PLATFORM_SPEC.md`](docs/SUNDAY_SCHOOL_PLATFORM_SPEC.md) | 需求規格書（需求基準） |
| [`CLAUDE.md`](CLAUDE.md) | AI 協作指引（角色權限、Roadmap、技術選型） |

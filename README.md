# TBOJ 國度領袖兒童部整合平台

> 「這樣，信心若沒有行為就是死的。」— 雅各書 2:17

以單一 Web APP / PWA 整合兒童主日學的日常行政與「神國小領袖」文化養成：

- 📋 **出席預先統計**：家長每週勾選孩子是否出席（可留言給老師），自動統計人數
- ✅ **現場簽到**：老師主日現場點名、臨時請假、課堂表情回饋與交接備註
- 🎵 **敬拜歌單佈達**：每週歌單與 YouTube 連結，家長與孩子一起預習
- 📢 **兒主公告**：管理者發布公告（置頂/標籤），所有人首頁可見
- 📒 **課堂紀錄**：教學內容、詩歌進度、課後反饋，全年連貫呈現、可匯出 CSV
- 👥 **名單與權限**：標籤式多角色（管理者/老師/家長）＋會員審核制，家長僅能看到自己綁定的孩子（資料庫層 RLS 強制）
- 🌱 **服事經歷卡**（規劃中）：記錄孩子自己的服事成長軌跡（不做排行、不做比較）

本專案隸屬於 [TBOJ（The Book of James）](https://github.com/nickyeh97/TBOJ) 信仰實踐計畫。

## 線上版本

📱 https://kingdom-little-leaders.vercel.app （手機瀏覽器開啟後可「加入主畫面」作為 App 使用）

## 技術棧

- 前端：Vue 3 + Vite + Vant（mobile-first PWA）
- 後端：Supabase（Postgres + Auth + Row Level Security）
- 影音：外連 / 嵌入 YouTube
- 部署：Vercel（push `main` 自動部署）

## 必讀文件

| 文件 | 說明 |
| --- | --- |
| [`docs/DESIGN_PRINCIPLES.md`](docs/DESIGN_PRINCIPLES.md) | **最高守則**——任何設計必須先通過檢核 |
| [`docs/SUNDAY_SCHOOL_PLATFORM_SPEC.md`](docs/SUNDAY_SCHOOL_PLATFORM_SPEC.md) | 需求規格書（需求基準） |
| [`docs/PROGRESS.md`](docs/PROGRESS.md) | **進度總覽**（已實作/未實作/外部依賴，每個 Sprint 更新） |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | 開發指南：開發/測試/後端初始化/部署/第三方登入設定 |
| [`CLAUDE.md`](CLAUDE.md) | AI 協作指引（角色權限、Roadmap、技術選型、設計決議） |
| [`docs/SPRINT_01.md`](docs/SPRINT_01.md)、[`docs/SPRINT_02.md`](docs/SPRINT_02.md) | 各階段開發範圍與回顧 |

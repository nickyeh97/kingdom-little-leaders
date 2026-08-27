# 自訂 SMTP 設定指南（Brevo）

> 目的：擺脫 Supabase 內建寄信額度（每小時 2–4 封、全專案共用），迎接開學大量家長註冊。
> 圖解網頁版：https://claude.ai/code/artifact/916217eb-4193-4895-a9a6-a39c1e59f0db
> 決議（2026-08-26）：寄信服務＝Brevo（免費 300 封/天、單一寄件人驗證、無需自有網域）；
> 註冊確認信（Confirm email）**維持關閉**——審核制把關，SMTP 服務「忘記密碼」與未來通知。

## 步驟

1. **註冊 Brevo＋驗證寄件人**：brevo.com 註冊 → Senders, Domains & Dedicated IPs → Senders → Add a sender
   （名稱「神國小領袖」＋一個收得到信的專用信箱）→ 到該信箱點驗證信。
2. **取得 SMTP 金鑰**：SMTP & API → SMTP 頁籤 → 記下 Login → Generate a new SMTP key（只顯示一次）。
   ⚠️ 金鑰只貼進 Supabase 後台，絕不進 repo／聊天紀錄。
3. **Supabase 填入**：Project Settings → Authentication → SMTP Settings → Enable Custom SMTP：

   | 欄位 | 值 |
   | --- | --- |
   | Sender email | 步驟 1 驗證過的信箱 |
   | Sender name | 神國小領袖 |
   | Host | `smtp-relay.brevo.com` |
   | Port | `587` |
   | Username | Brevo SMTP 頁的 Login |
   | Password | 步驟 2 的 SMTP key |

4. **調高速率**：Authentication → Rate Limits → Rate limit for sending emails → `60`／小時。
5. **模板中文化**：Authentication → Email Templates → Reset Password：
   - Subject：`【神國小領袖】重設密碼連結`
   - Body：問候＋`{{ .ConfirmationURL }}` 連結＋「非本人申請可忽略」（全文見網頁版指南）
   - Confirm signup 模板可順手中文化備用（目前關閉不寄）。
6. **測試**：登入頁「忘記密碼？」寄一封 → 1 分鐘內收到中文信＝完成；
   沒收到 → 垃圾信件匣 → Brevo Statistics → 檢查步驟 3 帳密。

## 維運備忘

- 免費層 300 封/天；超過需求再升級或換服務。
- 金鑰外洩：Brevo → SMTP & API → 刪舊金鑰重發，Supabase 換新值。
- 未來若買教會網域：改用網域驗證（SPF/DKIM），寄達率更佳；屆時 Resend 也可重新評估。

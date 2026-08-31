/**
 * 聚會流程的 Google Sheet 匯入（v9 #2）。
 *
 * 不走 Google API（教會雲端授權未到位，CLAUDE.md 決議 3）：
 * 同工在 Sheet 選取範圍複製後直接貼上（TSV），或上傳 CSV。
 * 這裡只負責「文字 → 結構化資料＋看得懂的錯誤」，寫入與 UI 由呼叫端處理。
 *
 * 錯誤訊息一律指到**第幾列、哪一欄**，不要只說「格式錯誤」讓同工自己猜。
 */

export interface SheetFlowRow {
  title: string
  extra: string
  minutes: number | null
  content: string
}

export interface SheetParseResult {
  rows: SheetFlowRow[]
  /** 逐列問題（可與 rows 併存：有問題的列不會進 rows） */
  errors: string[]
  /** 表頭對應到的欄位（供預覽顯示「我認得哪幾欄」） */
  mapped: { title: number; extra: number; minutes: number; content: number }
}

/** 表頭別名：同工的 Sheet 欄名不會完全一致，常見寫法都認 */
const HEADER_ALIASES: Record<keyof SheetParseResult['mapped'], string[]> = {
  title: ['項目', '標題', '主題', '流程', '流程項目'],
  extra: ['必要性', '方式', '必做選做', '類型'],
  minutes: ['建議分鐘', '分鐘', '時間', '時長', '建議時間'],
  content: ['內容', '說明', '詳細', '備註'],
}

/** 一列資料的欄位切分（支援雙引號包住的欄位，內含分隔字元或換行） */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      cells.push(cell)
      cell = ''
    } else cell += ch
  }
  cells.push(cell)
  return cells
}

/** 切列：雙引號內的換行屬於同一列（Sheet 的多行內容複製出來就是這樣） */
function splitRows(text: string): string[] {
  const lines: string[] = []
  let line = ''
  let quoted = false
  const normalized = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === '"') {
      quoted = !quoted
      line += ch
    } else if (ch === '\n' && !quoted) {
      lines.push(line)
      line = ''
    } else line += ch
  }
  if (line !== '') lines.push(line)
  return lines
}

/** 逗號比 tab 多就是 CSV，否則當 Sheet 直接複製的 TSV */
function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return commas > tabs ? ',' : '\t'
}

function findColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)))
}

/** 數字容錯：全形數字、「約 10 分鐘」這種寫法都取得到 */
function parseMinutesCell(cell: string): number | null | 'invalid' {
  const text = cell.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim()
  if (!text) return null
  const m = text.match(/\d+/)
  if (!m) return 'invalid'
  return Number(m[0])
}

export function parseFlowSheet(text: string): SheetParseResult {
  const empty = { title: -1, extra: -1, minutes: -1, content: -1 }
  const lines = splitRows(text).filter((l) => l.trim() !== '')
  if (lines.length === 0) {
    return { rows: [], errors: ['沒有讀到任何內容，請確認已複製 Sheet 的資料範圍。'], mapped: empty }
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitLine(lines[0], delimiter).map((h) => h.trim())
  const mapped = {
    title: findColumn(headers, HEADER_ALIASES.title),
    extra: findColumn(headers, HEADER_ALIASES.extra),
    minutes: findColumn(headers, HEADER_ALIASES.minutes),
    content: findColumn(headers, HEADER_ALIASES.content),
  }

  if (mapped.title < 0) {
    return {
      rows: [],
      errors: [
        `第 1 列（表頭）找不到「項目」欄——目前讀到的欄名是：${headers.join('、') || '（空白）'}。` +
          '請確認第一列是欄位名稱，且其中一欄叫「項目」或「主題」。',
      ],
      mapped,
    }
  }

  const rows: SheetFlowRow[] = []
  const errors: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter)
    const at = (idx: number) => (idx >= 0 ? (cells[idx] ?? '').trim() : '')
    const rowNo = i + 1

    const title = at(mapped.title)
    if (!title) {
      errors.push(`第 ${rowNo} 列：「項目」是空的，這一列會略過。`)
      continue
    }

    const minutesCell = at(mapped.minutes)
    const minutes = parseMinutesCell(minutesCell)
    if (minutes === 'invalid') {
      errors.push(`第 ${rowNo} 列：「建議分鐘」讀不到數字（目前是「${minutesCell}」），這一列會略過。`)
      continue
    }

    const extra = at(mapped.extra)
    if (extra && !/必做|選做|彈性/.test(extra)) {
      errors.push(`第 ${rowNo} 列：「必要性」建議填「必做」或「選做」（目前是「${extra}」，仍會照原文匯入）。`)
    }

    rows.push({ title, extra, minutes, content: at(mapped.content) })
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('表頭之外沒有任何資料列，請確認複製範圍有包含內容。')
  }
  return { rows, errors, mapped }
}

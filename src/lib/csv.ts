/** CSV 匯出工具：UTF-8 含 BOM（Excel/Google Sheet 開啟中文不亂碼） */

const BOM = '﻿'

function escapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function toCsv(rows: string[][]): string {
  return BOM + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

/** 觸發瀏覽器下載（可另存至教會 NAS，或直接匯入 Google Sheet） */
export function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

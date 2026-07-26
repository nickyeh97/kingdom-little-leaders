/** 主日（週日）與預先出席截止時間的計算工具。全部使用瀏覽器本地時區（台灣使用情境）。 */

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 下一個主日（若今天就是週日，回傳今天）— 供點名、出席勾選共用 */
export function upcomingSunday(from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return toDateString(d)
}

/** 上一個主日（若今天是週日，回傳今天）— 供家長端查看課堂回饋 */
export function lastSunday(from = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() - d.getDay())
  return toDateString(d)
}

/** 該主日的填寫截止時間：主日前的週三 23:59:59 */
export function planDeadline(sundayDate: string): Date {
  const d = new Date(`${sundayDate}T23:59:59`)
  d.setDate(d.getDate() - 4) // 週日 -4 天 = 週三
  return d
}

/** 預先出席是否仍開放填寫 */
export function isPlanOpen(sundayDate: string, now = new Date()): boolean {
  return now <= planDeadline(sundayDate)
}

export function formatSunday(sundayDate: string): string {
  const [y, m, d] = sundayDate.split('-')
  return `${y}/${m}/${d}（主日）`
}

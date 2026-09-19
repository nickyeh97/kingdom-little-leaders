/**
 * `style.test.ts` 要讀 style.css 的實際檔案內容來把關全域防溢出規則。
 *
 * Vitest 預設會把 CSS 匯入換成空字串（連 `?raw` 也一樣），所以只能走 `node:fs`；
 * 但專案的 tsconfig 只帶 `vite/client` 型別、沒有裝 `@types/node`。
 * 為了一支測試多一包相依不划算，這裡只宣告實際用到的那一個函式。
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}

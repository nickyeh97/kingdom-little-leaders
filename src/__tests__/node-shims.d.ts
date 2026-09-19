/**
 * style.test.ts 要用 node:fs 讀 style.css（Vitest 會把 CSS 匯入換成空字串，?raw 也一樣）。
 * tsconfig 只帶 vite/client、沒裝 @types/node；為一支測試多裝一包不划算，只宣告用到的函式。
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}

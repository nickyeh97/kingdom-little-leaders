/**
 * 把關 style.css 的全域防溢出規則。
 * 這三條沒有函式可以測，但少了任何一條，一則超長網址就會再次把整頁撐破，
 * 所以直接檢查檔案內容，避免整理樣式時被順手刪掉。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// .vue 用 ?raw 讀得到；.css 會被 Vitest 換成空字串，只能走 node:fs
import serviceView from '../views/ServiceView.vue?raw'
import classLogView from '../views/ClassLogView.vue?raw'
import lessonPlanView from '../views/LessonPlanView.vue?raw'

const rules = readFileSync(new URL('../style.css', import.meta.url).pathname, 'utf8')
  // 去掉註解，免得被註解裡提到的規則名稱矇過
  .replace(/\/\*[\s\S]*?\*\//g, '')

describe('全域防溢出', () => {
  it('文字可斷行：掛在 body 上靠繼承全站生效', () => {
    expect(rules).toMatch(/body\s*\{[^}]*overflow-wrap:\s*break-word/)
  })

  it('圖片／影片／內嵌不得寬於容器', () => {
    expect(rules).toMatch(/img,\s*video,\s*iframe,\s*canvas,\s*svg,\s*embed,\s*object\s*\{\s*max-width:\s*100%/)
  })

  it('最後一道保險：頁面本身不可橫向撐開', () => {
    expect(rules).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/)
  })
})

describe('需要橫捲的區塊仍保有自己的 overflow-x: auto', () => {
  it.each([
    ['ServiceView 服事總覽表', serviceView],
    ['ClassLogView 日期列', classLogView],
    ['LessonPlanView 日期列', lessonPlanView],
  ])('%s', (_name, src) => {
    expect(src).toMatch(/overflow-x:\s*auto/)
  })
})

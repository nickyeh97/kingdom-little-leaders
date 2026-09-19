/**
 * 全域防溢出規則的回歸測試。
 *
 * 這三條規則沒有對應的函式可以測，但少了任何一條，畫面就會再次被
 * 「一則 743 字元、整串沒有可斷行處的網址」撐破（平板上看起來就是整頁縮小跑版）。
 * 所以直接對 `style.css` 的內容把關，避免日後整理樣式時被順手刪掉。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// `.vue` 用 Vite 的 `?raw` 就讀得到；`.css` 會被 Vitest 換成空字串，只能走 node:fs
import serviceView from '../views/ServiceView.vue?raw'
import classLogView from '../views/ClassLogView.vue?raw'
import lessonPlanView from '../views/LessonPlanView.vue?raw'

const css = readFileSync(new URL('../style.css', import.meta.url).pathname, 'utf8')

/** 去掉註解再比對，才不會被註解裡提到的規則名稱騙過去 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('全域防溢出', () => {
  it('第一層：文字可斷行（掛在 body 上靠繼承全站通用）', () => {
    expect(rules).toMatch(/body\s*\{[^}]*overflow-wrap:\s*break-word/)
  })

  it('不使用 break-all，正常的英文句子不該被從單字中間切開', () => {
    expect(rules).not.toMatch(/^\s*body\s*\{[^}]*word-break:\s*break-all/m)
  })

  it('第二層：圖片／影片／內嵌不得寬於容器', () => {
    const media = rules.match(/([^}]*?)\{\s*max-width:\s*100%;?\s*\}/g)?.join('') ?? ''
    for (const tag of ['img', 'video', 'iframe']) {
      expect(media).toMatch(new RegExp(`(^|[,\\s])${tag}(,|\\s)`))
    }
  })

  it('第三層：最後一道保險，任何元素都不能把頁面撐寬', () => {
    expect(rules).toMatch(/html,\s*body\s*\{[^}]*overflow-x:\s*hidden/)
  })
})

describe('真的需要橫捲的容器仍保有自己的捲動', () => {
  it.each([
    ['ServiceView（服事總覽表）', serviceView],
    ['ClassLogView（日期列）', classLogView],
    ['LessonPlanView（日期列）', lessonPlanView],
  ])('%s 內仍有 overflow-x: auto 的容器', (_name, src) => {
    expect(src).toMatch(/overflow-x:\s*auto/)
  })
})

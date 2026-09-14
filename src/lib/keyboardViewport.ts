/**
 * 手機／平板軟體鍵盤遮住輸入框的修正（v15 #2）。
 *
 * ## 症狀
 *
 * 平板上編輯教案的「課後執行」，鍵盤一跳出來就把輸入框蓋住，看不到自己在打什麼。
 * 老師自己找到的權宜做法是「長按」——長按走的是文字選取的捲動路徑，跟一般聚焦不同，
 * 所以剛好把欄位捲了出來。同一個彈窗裡每個欄位都有這問題，只是「課後執行」在最下面最明顯。
 *
 * ## 為什麼會這樣
 *
 * 底部彈窗（`.van-popup--bottom`）是 `position: fixed; bottom: 0`，高度 `85dvh`。
 *
 * 軟體鍵盤**不會**縮小版面視窗（layout viewport）——`vh`／`dvh` 與 `window.innerHeight`
 * 都不受鍵盤影響（`dvh` 反應的是瀏覽器工具列，不是鍵盤）。鍵盤只縮小**視覺視窗**
 * （visual viewport）。所以彈窗仍然貼在版面視窗底部、維持原本高度，
 * 下半截就整個躲到鍵盤後面。
 *
 * 瀏覽器原生的「把聚焦欄位捲進畫面」是捲**頁面**；彈窗是 fixed，頁面怎麼捲它都不動，
 * 而彈窗內部那個 `overflow-y: auto` 的捲動容器瀏覽器不會幫忙捲。兩邊都失效，欄位就出不來。
 *
 * `interactive-widget=resizes-content` 那個 viewport meta 能讓版面視窗跟著縮，
 * 但 Chrome/Firefox 有、**iOS Safari 尚未公開支援**，所以不能靠它。
 *
 * ## 做法
 *
 * 1. 用 `visualViewport` 算出鍵盤高度，寫進 CSS 變數 `--kll-keyboard`；
 *    `style.css` 讓底部彈窗往上讓開這段距離、並同步減掉可用高度。
 * 2. 彈窗內的欄位聚焦時，主動把它捲到可視範圍中間——光靠 (1) 還不夠，
 *    因為欄位可能落在彈窗內部捲動容器的視野之外。
 *
 * 兩段都做才完整：(1) 讓彈窗不再被蓋住，(2) 讓欄位真的出現在彈窗的可視區內。
 */

/**
 * 低於這個高度不當成鍵盤（px）。
 *
 * 手機瀏覽器的網址列伸縮也會讓視覺視窗差個幾十 px，那不是鍵盤，
 * 跟著位移反而會讓畫面抖動。實體鍵盤一般都遠高於這個值。
 */
export const KEYBOARD_MIN_INSET = 120

/**
 * 從三個視窗數值算出鍵盤佔掉的高度。
 *
 * `offsetTop` 要一起扣：視覺視窗被往下捲動時（iOS 捏放縮放或捲動中）
 * 它與版面視窗頂端會有落差，不扣就會把那段誤算成鍵盤。
 */
export function keyboardInset(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number {
  const inset = layoutHeight - visualHeight - visualOffsetTop
  if (!Number.isFinite(inset) || inset < KEYBOARD_MIN_INSET) return 0
  return Math.round(inset)
}

/** 這個元素是使用者會打字的地方嗎？ */
export function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  // 兩種都查：`isContentEditable` 會把繼承自祖先的算進來，但 jsdom 沒實作它；
  // 屬性選擇器補上 jsdom，`closest` 同時涵蓋祖先繼承的情況
  if (el.isContentEditable) return true
  if (el.closest('[contenteditable=""], [contenteditable="true"]')) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA') return true
  if (tag !== 'INPUT') return false
  // button / checkbox / radio 這些不會叫出鍵盤，捲了只是徒增跳動
  const type = (el as HTMLInputElement).type
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range'].includes(type)
}

/** 鍵盤動畫跑完、`--kll-keyboard` 也更新完才捲，否則會捲到舊位置 */
const SCROLL_DELAY_MS = 320

/**
 * 掛上監聽，回傳解除函式（測試與熱重載用）。
 *
 * 舊瀏覽器沒有 `visualViewport` 就整個略過——維持現狀，不會比現在更糟。
 */
export function installKeyboardViewport(): () => void {
  const vv = window.visualViewport
  const root = document.documentElement
  const cleanups: Array<() => void> = []

  if (vv) {
    const sync = () => {
      const inset = keyboardInset(window.innerHeight, vv.height, vv.offsetTop)
      root.style.setProperty('--kll-keyboard', `${inset}px`)
    }
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    sync()
    cleanups.push(() => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      root.style.removeProperty('--kll-keyboard')
    })
  }

  /*
   * 只處理彈窗內的欄位：一般頁面上的欄位瀏覽器自己捲得動（頁面不是 fixed），
   * 再插手只會讓畫面多跳一次。
   */
  const onFocusIn = (e: Event) => {
    const el = e.target
    if (!isTextEntry(el as Element)) return
    const field = el as HTMLElement
    if (!field.closest('.van-popup--bottom')) return
    window.setTimeout(() => {
      // 這段延遲裡使用者可能已經關掉彈窗或點到別的欄位
      if (document.activeElement !== field || !field.isConnected) return
      field.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, SCROLL_DELAY_MS)
  }
  document.addEventListener('focusin', onFocusIn)
  cleanups.push(() => document.removeEventListener('focusin', onFocusIn))

  return () => cleanups.forEach((fn) => fn())
}

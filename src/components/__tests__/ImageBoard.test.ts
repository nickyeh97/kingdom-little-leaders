// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageBoard from '../ImageBoard.vue'

const base = {
  title: '組織架構與分工',
  hint: '點圖可放大',
  src: '/兒童部組織架構.png',
  alt: '兒童部組織架構',
}

describe('ImageBoard 圖片限高（v0.3.1）', () => {
  it('沒給 maxHeight 時圖片不限高（異象頁：下方沒有其他內容）', () => {
    const w = mount(ImageBoard, { props: base })
    const style = w.get('img').attributes('style') ?? ''
    expect(style).not.toContain('max-height')
    expect(w.find('.zoom-btn').exists()).toBe(false)
  })

  it('給了 maxHeight 就限高並保持比例，另附放大按鈕', () => {
    const w = mount(ImageBoard, { props: { ...base, maxHeight: '42vh' } })
    const style = w.get('img').attributes('style') ?? ''
    expect(style).toContain('max-height: 42vh')
    expect(style).toContain('object-fit: contain')
    expect(w.get('.zoom-btn').text()).toContain('放大')
  })

  it('邊際：圖檔載入失敗時顯示提示而非破圖', async () => {
    const w = mount(ImageBoard, { props: base })
    await w.get('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('尚未放置圖片')
  })
})

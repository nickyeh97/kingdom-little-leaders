/**
 * 從一張原圖產生全套 PWA / favicon 圖示。
 *
 *   npm i -D playwright && npx playwright install chromium   # 只在換 logo 時裝，跑完可移除
 *   node scripts/gen-icons.mjs assets/kll_logo-src.webp public
 *
 * playwright 刻意不列為專案相依：換 logo 很少發生，產出的圖已進版控，平常建置用不到這支。
 *
 * favicon.ico 另外產（ICO 容器包一張 32px PNG）：
 *   python3 -c "import struct;p=open('public/kll_logo-32.png','rb').read();\
 *     open('public/favicon.ico','wb').write(struct.pack('<HHH',0,1,1)+\
 *     struct.pack('<BBBBHHII',32,32,0,0,1,32,len(p),22)+p)"
 *
 * 做法：原圖是「白底＋紫色圓角方塊」，直接縮放會在 OS 的圓角遮罩下露出白邊。
 * 所以先以主色找出方塊外框裁掉白邊，輸出時鋪滿主色、再用圓角裁切把方塊畫上去。
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const SRC = process.argv[2]
const OUT = process.argv[3] || '.'
if (!SRC) throw new Error('用法: node scripts/gen-icons.mjs assets/kll_logo-src.webp public')

// 預設用 playwright install 裝的 Chromium；環境另有瀏覽器時可用 CHROMIUM_PATH 指定
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const p = await b.newPage()
const ext = path.extname(SRC).slice(1) || 'png'
const dataUri = `data:image/${ext};base64,${fs.readFileSync(SRC).toString('base64')}`

const result = await p.evaluate(async (uri) => {
  const img = new Image()
  img.src = uri
  await img.decode()
  const W = img.naturalWidth
  const H = img.naturalHeight

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, W, H).data
  const at = (x, y) => (y * W + x) * 4

  // 背景＝夠亮且接近中性灰（WebP 壓縮讓白底帶雜色，門檻不能抓太死）
  const isBg = (i) => {
    const mx = Math.max(px[i], px[i + 1], px[i + 2])
    const mn = Math.min(px[i], px[i + 1], px[i + 2])
    return mn > 225 && mx - mn < 18
  }

  // 1. 主色＝非背景像素中出現最多的顏色（量化到 8 階後取平均），比單點採樣穩
  const hist = new Map()
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      const i = at(x, y)
      if (isBg(i)) continue
      const k = ((px[i] >> 5) << 10) | ((px[i + 1] >> 5) << 5) | (px[i + 2] >> 5)
      const e = hist.get(k)
      if (e) { e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2] }
      else hist.set(k, { n: 1, r: px[i], g: px[i + 1], b: px[i + 2] })
    }
  const top = [...hist.values()].sort((a, b) => b.n - a.n)[0]
  const base = [Math.round(top.r / top.n), Math.round(top.g / top.n), Math.round(top.b / top.n)]

  // 2. 方塊外框＝與主色接近的像素範圍（logo 內的淺色人形不影響外框，方塊四邊都是主色）
  const near = (i) =>
    Math.abs(px[i] - base[0]) + Math.abs(px[i + 1] - base[1]) + Math.abs(px[i + 2] - base[2]) < 90
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (near(at(x, y))) {
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }

  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const side = Math.max(bw, bh)
  const cx = x0 + bw / 2
  const cy = y0 + bh / 2

  const fill = `rgb(${base.join(',')})`
  /**
   * inset：內縮比例。`any` 用 0（滿版，OS 自己套圓角）；
   * maskable 用 0.1，把內容收進 Android 自適應圖示的安全區。
   */
  const render = (size, inset) => {
    const o = document.createElement('canvas')
    o.width = size
    o.height = size
    const g = o.getContext('2d')
    g.imageSmoothingQuality = 'high'
    g.fillStyle = fill
    g.fillRect(0, 0, size, size)

    const pad = Math.round(size * inset)
    const box = size - pad * 2
    g.save()
    // 圓角裁切：半徑抓方塊寬的 20%，比原圖圓角略大，
    // 確保白色的角落一定落在裁切外（外面已經是主色，看不出接縫）
    const r = box * 0.2
    g.beginPath()
    g.roundRect(pad, pad, box, box, r)
    g.clip()
    /*
     * 來源多畫 3%（超出裁切範圍）：原圖圓角的抗鋸齒外緣是白的，
     * 不溢出的話會沿著圓角留一條白色髮絲邊。多畫的部分被 clip 切掉。
     */
    const over = Math.round(box * 0.03)
    g.drawImage(
      c,
      cx - side / 2, cy - side / 2, side, side,
      pad - over, pad - over, box + over * 2, box + over * 2,
    )
    g.restore()
    return o.toDataURL('image/png')
  }

  return {
    W, H, box: [x0, y0, x1, y1], side,
    base: '#' + base.map((v) => v.toString(16).padStart(2, '0')).join(''),
    master: render(1024, 0),
    i512: render(512, 0),
    i192: render(192, 0),
    i180: render(180, 0),
    i32: render(32, 0),
    maskable: render(512, 0.1),
  }
}, dataUri)

console.log(
  `原圖 ${result.W}×${result.H}｜方塊外框 [${result.box}]｜裁成 ${result.side}²｜主色 ${result.base}`,
)
const files = {
  'kll_logo.png': result.master,
  'kll_logo-512.png': result.i512,
  'kll_logo-192.png': result.i192,
  'kll_logo-180.png': result.i180,
  'kll_logo-32.png': result.i32,
  'kll_logo-maskable-512.png': result.maskable,
}
for (const [name, uri] of Object.entries(files)) {
  const buf = Buffer.from(uri.split(',')[1], 'base64')
  fs.writeFileSync(path.join(OUT, name), buf)
  console.log(`  ${name.padEnd(28)} ${(buf.length / 1024).toFixed(1)} KB`)
}
await b.close()

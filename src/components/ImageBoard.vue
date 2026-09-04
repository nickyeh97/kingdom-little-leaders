<script setup lang="ts">
/**
 * 圖片型內容區塊（組織架構、異象）：內容由同工維護的一張圖，換內容＝換 public/ 底下的圖檔。
 *
 * 這是**區塊**不是整頁：外層 `.page` 由使用它的頁面負責。
 * （原本自帶 `.page`，而 `.page` 有 `min-height: 100vh`——
 *  組織架構頁在它下面接老師名單時，名單會被整整一個螢幕的空白推出第一屏。）
 * 圖檔尚未放入時顯示提示文字，不會出現破圖。
 * 注意：public/ 是靜態資源，未登入者拿到網址即可開啟——圖上只放職稱與稱呼，勿放聯絡資料。
 */
import { ref } from 'vue'
import { showImagePreview } from 'vant'

const props = withDefaults(
  defineProps<{
    title: string
    hint: string
    /** 圖檔路徑（public/ 底下，如 `/兒童部組織架構.png`） */
    src: string
    alt: string
    /**
     * 圖片最大高度（CSS 值）。頁面下方還有內容時要限高，
     * 否則手機上整張圖撐滿寬度後很高，會把下面的內容擠出第一屏。
     * 細節看不清楚沒關係——點圖就能放大。
     */
    maxHeight?: string
  }>(),
  { maxHeight: '' },
)

const imgOk = ref(true)

function zoom() {
  showImagePreview({ images: [props.src], closeable: true })
}
</script>

<template>
  <section class="board">
    <h2>{{ title }}</h2>
    <p class="hint">{{ hint }}</p>

    <div v-if="imgOk" class="card img-card">
      <img
        :src="src"
        :alt="alt"
        class="board-img"
        :style="maxHeight ? { maxHeight, objectFit: 'contain' } : undefined"
        @click="zoom"
        @error="imgOk = false"
      />
      <button v-if="maxHeight" type="button" class="zoom-btn" @click="zoom">🔍 點圖放大看細節</button>
    </div>
    <div v-else class="card hint">
      尚未放置圖片。請同工將圖檔放入專案的 <code>public{{ src }}</code> 後重新部署即可顯示。
    </div>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 4px;
  font-size: 25px;
}
.img-card {
  padding: 10px;
}
.board-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  cursor: zoom-in;
}
.zoom-btn {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 6px 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  color: var(--kll-primary);
  cursor: pointer;
}
.zoom-btn:focus-visible {
  outline: 2px solid var(--kll-primary);
  outline-offset: 2px;
  border-radius: 6px;
}
code {
  font-size: 14px;
  word-break: break-all;
}
</style>

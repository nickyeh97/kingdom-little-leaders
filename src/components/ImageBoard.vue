<script setup lang="ts">
/**
 * 圖片型內容頁（組織架構、異象）：內容由同工維護的一張圖，換內容＝換 public/ 底下的圖檔。
 * 圖檔尚未放入時顯示提示文字，不會出現破圖。
 * 注意：public/ 是靜態資源，未登入者拿到網址即可開啟——圖上只放職稱與稱呼，勿放聯絡資料。
 */
import { ref } from 'vue'
import { showImagePreview } from 'vant'

const props = defineProps<{
  title: string
  hint: string
  /** 圖檔路徑（public/ 底下，如 `/兒童部組織架構.png`） */
  src: string
  alt: string
}>()

const imgOk = ref(true)

function zoom() {
  showImagePreview({ images: [props.src], closeable: true })
}
</script>

<template>
  <div class="page">
    <h2>{{ title }}</h2>
    <p class="hint">{{ hint }}</p>

    <div v-if="imgOk" class="card img-card">
      <img :src="src" :alt="alt" class="board-img" @click="zoom" @error="imgOk = false" />
    </div>
    <div v-else class="card hint">
      尚未放置圖片。請同工將圖檔放入專案的 <code>public{{ src }}</code> 後重新部署即可顯示。
    </div>
  </div>
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
code {
  font-size: 14px;
  word-break: break-all;
}
</style>

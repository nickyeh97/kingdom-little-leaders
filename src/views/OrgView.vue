<script setup lang="ts">
/**
 * 組織架構與分工：改為直接顯示同工維護的一張圖（2026-08-28 決議）。
 * 換架構＝換圖檔（`public/org/org-chart.png`），平台端不再提供新增/編輯。
 * 注意：public/ 內的檔案是靜態資源，未登入者拿到網址即可開啟——
 * 圖上請只放同工職稱與稱呼，勿放電話、地址等聯絡資料。
 */
import { ref } from 'vue'
import { showImagePreview } from 'vant'

const ORG_CHART_SRC = '/org/org-chart.png'
const imgOk = ref(true)

function zoom() {
  showImagePreview({ images: [ORG_CHART_SRC], closeable: true })
}
</script>

<template>
  <div class="page">
    <h2>組織架構與分工</h2>
    <p class="hint">兒童部的督導、主責同工與各班負責同工（點圖可放大）</p>

    <div v-if="imgOk" class="card img-card">
      <img
        :src="ORG_CHART_SRC"
        alt="兒童部組織架構與分工"
        class="org-img"
        @click="zoom"
        @error="imgOk = false"
      />
    </div>
    <div v-else class="card hint">
      尚未放置組織架構圖。請同工將圖片存成
      <code>public/org/org-chart.png</code> 後重新部署即可顯示。
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
.org-img {
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

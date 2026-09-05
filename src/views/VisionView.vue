<script setup lang="ts">
/**
 * 國度領袖兒童異象（計畫核心，v8 #1）：顯示同工維護的異象圖。
 * 全員可看——含尚未審核的新成員，讓新家長/新老師一進來就知道兒童牧區在做什麼。
 * 文字版留在 README／CLAUDE／規格書／操作手冊，平台端只維護這一張圖避免兩邊走鐘。
 */
import ImageBoard from '../components/ImageBoard.vue'
</script>

<template>
  <div class="page">
    <ImageBoard
      title="國度領袖兒童異象"
      hint="培育神國小領袖，活出天父美好的計畫（點圖可放大）"
      src="/國度領袖兒童牧區異象.jpg"
      alt="國度領袖兒童異象：核心三要點"
    />
  </div>
</template>

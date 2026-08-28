<script setup lang="ts">
/**
 * 組織架構與分工：直接顯示同工維護的一張架構圖（v8 #2）。
 * 換架構＝換掉 `public/兒童部組織架構.png`，平台端不再提供新增/編輯。
 * `org_units` 資料表與 API 保留，日後要回復逐項維護不需 migration。
 */
import ImageBoard from '../components/ImageBoard.vue'
</script>

<template>
  <ImageBoard
    title="組織架構與分工"
    hint="兒童部的督導、主責同工與各班負責同工（點圖可放大）"
    src="/兒童部組織架構.png"
    alt="兒童部組織架構與分工"
  />
</template>

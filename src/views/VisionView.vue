<script setup lang="ts">
/**
 * 國度領袖兒童異象（計畫核心）。
 * 內容固定不變動，直接寫在頁面上（不進資料庫、無編輯入口）；
 * 全員可看——含尚未審核的新成員，讓新家長/新老師一進來就知道兒童部在做什麼。
 */
</script>

<template>
  <div class="page">
    <h2>國度領袖兒童異象</h2>

    <div class="card slogan">培育神國小領袖，活出天父美好的計畫。</div>

    <div class="card body">
      <p>
        引導孩子建立正確的自我形象與身分認同，明白自己是天父的孩子、獨一無二且有美好的品格與任務，
        進而產生願意遵守紀律、學習真理、樂意服事的內在動機。
      </p>
      <p class="last">成為有影響力的國度領袖。</p>
    </div>

    <h3 class="section-title">核心三要點</h3>
    <div class="card point">
      <span class="num">1</span>
      <div>
        <strong>自我形象</strong>
        <p>確信天父孩子的身分，是神獨一無二的創造。</p>
      </div>
    </div>
    <div class="card point">
      <span class="num">2</span>
      <div>
        <strong>品格塑造</strong>
        <p>認真學習真理，活像耶穌充滿愛心、信心與智慧。</p>
      </div>
    </div>
    <div class="card point">
      <span class="num">3</span>
      <div>
        <strong>活出計畫</strong>
        <p>操練服事、增強能力，成為國度領袖。</p>
      </div>
    </div>

    <p class="hint foot">
      平台上的每個功能都回到這個異象：服事經歷卡記錄孩子自己的成長軌跡（不比較、不排行）；
      出席與課堂紀錄是關懷與行政工具（不施壓、不標籤）。
    </p>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 12px;
  font-size: 25px;
}
.slogan {
  font-size: 21px;
  font-weight: 700;
  line-height: 1.6;
  text-align: center;
  color: var(--kll-primary-dark);
  background: var(--kll-primary-soft);
}
.body p {
  margin: 0;
  font-size: 17px;
  line-height: 1.8;
}
.body .last {
  margin-top: 10px;
  font-weight: 700;
  color: var(--kll-primary-dark);
}
.section-title {
  margin: 22px 0 8px;
  font-size: 19px;
}
.point {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.point .num {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--kll-primary);
  color: #fff;
  font-weight: 700;
  text-align: center;
  line-height: 30px;
}
.point strong {
  font-size: 18px;
}
.point p {
  margin: 4px 0 0;
  font-size: 16px;
  color: var(--kll-sub);
  line-height: 1.7;
}
.foot {
  margin-top: 18px;
}
</style>

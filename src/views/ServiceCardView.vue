<script setup lang="ts">
/**
 * 小領袖靈獸（服事經歷卡電子版）——家長端的服事卡頁。
 *
 * 流程（組長 2026-10-30：老師不增加任何工作）：老師照舊在紙本服事卡簽名 →
 * 家長看到簽名後，陪孩子在遊戲裡按「＋1 服事」。這一頁只給家長三件事：
 *   1. 去看靈獸（帶授權片段開遊戲）
 *   2. 寫給孩子的鼓勵話（遊戲裡靈獸會說出其中一句）
 *   3. 看服事紀錄，記錯了刪掉（只能刪自己登錄的）
 * 權限全在 RLS（migration 2026-10-02_service_card），前端判斷只是 UX。
 * 守則：只呈現孩子自己的軌跡，不顯示「還差幾次進化」。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { showConfirmDialog, showFailToast, showSuccessToast } from 'vant'
import { listMyChildren } from '../api/attendance'
import { listChildServiceItems } from '../api/childService'
import {
  deleteServiceCardEntry,
  getBeastProfile,
  listServiceCardEntries,
  saveEncouragements,
} from '../api/serviceCard'
import { db } from '../lib/supabase'
import { spiritBeastEligible, spiritGameBaseUrl, spiritGameLink } from '../lib/spiritGame'
import {
  MAX_ENCOURAGEMENT_LENGTH,
  MAX_ENCOURAGEMENTS,
  entryDate,
  parseEncouragements,
  serviceCardRows,
  stageName,
} from '../lib/serviceCard'
import { useAuthStore } from '../stores/auth'
import type { BeastProfile, Child, ChildServiceItem, ServiceCardEntry } from '../types'

const auth = useAuthStore()
const gameUrl = spiritGameBaseUrl()

const kids = ref<Child[]>([])
const childId = ref('')
const items = ref<ChildServiceItem[]>([])
const entries = ref<ServiceCardEntry[]>([])
const profile = ref<BeastProfile | null>(null)
const wordsDraft = ref('')
const loading = ref(true)
const saving = ref(false)

const rows = computed(() => serviceCardRows(items.value, entries.value))
const stage = computed(() => stageName(entries.value.length))
const myId = computed(() => auth.session?.user.id)

async function loadChild(id: string) {
  if (!id) return
  try {
    const [es, p] = await Promise.all([listServiceCardEntries(id), getBeastProfile(id)])
    entries.value = es
    profile.value = p
    wordsDraft.value = (p?.encouragements ?? []).join('\n')
  } catch (e) {
    showFailToast((e as Error).message)
  }
}

onMounted(async () => {
  try {
    const [ks, its] = await Promise.all([listMyChildren(), listChildServiceItems()])
    kids.value = ks.filter(spiritBeastEligible)
    items.value = its
    childId.value = kids.value[0]?.id ?? ''
    await loadChild(childId.value)
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    loading.value = false
  }
})

watch(childId, (id, old) => {
  if (old) loadChild(id)
})

async function goBeast() {
  const token = (await db().auth.getSession()).data.session?.access_token
  if (!token) {
    showFailToast('登入已過期，請重新登入')
    return
  }
  // 同一分頁開啟：iOS 會擋非點擊當下的新視窗；遊戲裡的「回到牧區平台」或返回鍵就回到這裡
  window.location.href = spiritGameLink(gameUrl, token, childId.value)
}

async function saveWords() {
  const { words, error } = parseEncouragements(wordsDraft.value)
  if (error) {
    showFailToast(error)
    return
  }
  saving.value = true
  try {
    await saveEncouragements(childId.value, words)
    wordsDraft.value = words.join('\n')
    showSuccessToast(words.length ? '已存好，靈獸會說給孩子聽' : '已清空，靈獸會改說經文')
  } catch (e) {
    showFailToast((e as Error).message)
  } finally {
    saving.value = false
  }
}

async function removeEntry(e: ServiceCardEntry) {
  try {
    await showConfirmDialog({
      title: '刪除這筆紀錄？',
      message: `${entryDate(e.created_at)}　${e.item}\n記錯了才需要刪；刪掉後可以在遊戲裡重新登錄。`,
    })
  } catch {
    return // 按取消
  }
  try {
    await deleteServiceCardEntry(e.id)
    entries.value = entries.value.filter((x) => x.id !== e.id)
    showSuccessToast('已刪除')
  } catch (err) {
    showFailToast((err as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <h2>小領袖靈獸</h2>
    <p class="hint">
      孩子的服事經歷卡。老師在紙本卡簽名後，陪孩子到遊戲裡按「＋1 服事」，靈獸就會跟著長大。
    </p>

    <van-loading v-if="loading" class="loading" />

    <p v-else-if="kids.length === 0" class="card hint">小領袖靈獸目前只開放兒童班。</p>

    <template v-else>
      <van-tabs v-if="kids.length > 1" v-model:active="childId" type="card" class="tabs">
        <van-tab v-for="k in kids" :key="k.id" :name="k.id" :title="k.name" />
      </van-tabs>

      <van-button v-if="gameUrl" type="primary" block round class="go" @click="goBeast">
        去看靈獸 ▶
      </van-button>

      <h3 class="section-title" style="--sec: var(--kll-green)">服事卡</h3>
      <div class="card">
        <p class="stage">靈獸現在是「{{ stage }}」　·　服事 {{ entries.length }} 次</p>
        <div v-for="r in rows" :key="r.item" class="row">
          <span>{{ r.item }}<span v-if="r.retired" class="sub">（已停用）</span></span>
          <span class="lv">{{ r.count ? `${r.level} 等` : '1 等 · 等你來探索' }}</span>
        </div>
      </div>

      <h3 class="section-title" style="--sec: var(--kll-pink)">寫給孩子的話</h3>
      <div class="card">
        <template v-if="profile">
          <p class="hint small">
            孩子打開遊戲、登錄服事後，靈獸會說出其中一句；沒寫的時候說經文。
            一行一句，最多 {{ MAX_ENCOURAGEMENTS }} 句、每句 {{ MAX_ENCOURAGEMENT_LENGTH }} 字以內。
          </p>
          <van-field
            v-model="wordsDraft"
            type="textarea"
            rows="5"
            autosize
            placeholder="例：謝謝你願意服事，爸媽好開心！"
            class="words"
          />
          <van-button type="primary" size="small" round :loading="saving" @click="saveWords">
            存好
          </van-button>
        </template>
        <p v-else class="hint small">
          孩子第一次打開遊戲、選好自己的靈獸之後，就可以在這裡寫給孩子的話。
        </p>
      </div>

      <h3 class="section-title" style="--sec: var(--kll-orange)">服事紀錄</h3>
      <div class="card">
        <p v-if="entries.length === 0" class="hint small">還沒有紀錄，第一次服事就從這裡開始。</p>
        <div v-for="e in entries" :key="e.id" class="row">
          <span>
            {{ entryDate(e.created_at) }}　{{ e.item }}<span v-if="e.fruit" class="sub"> · {{ e.fruit }}</span>
          </span>
          <van-button v-if="e.recorded_by === myId" size="small" plain class="del" @click="removeEntry(e)">
            刪除
          </van-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.loading {
  margin: 40px auto;
  display: block;
  text-align: center;
}
.tabs {
  margin: 8px 0 12px;
}
.go {
  margin: 4px 0 8px;
  font-size: 18px;
}
.stage {
  margin: 0 0 8px;
  font-weight: 600;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--kll-line, #eee);
  font-size: 17px;
}
.row:last-child {
  border-bottom: none;
}
.lv {
  flex-shrink: 0;
  color: var(--kll-sub);
}
.sub {
  color: var(--kll-sub);
}
.del {
  flex-shrink: 0;
  color: var(--kll-sub);
}
.small {
  font-size: 15px;
  margin: 0 0 8px;
}
.words {
  margin-bottom: 10px;
  border-radius: 10px;
  background: var(--kll-bg, #f7f7f7);
}
</style>

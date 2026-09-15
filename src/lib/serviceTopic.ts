/**
 * 服事頁的「預排主題」與「預計出席人數」（v16 #1、#2）。
 *
 * 兩件事都是**查表＋彙總**的純邏輯，抽出來才測得到——
 * ServiceView 已經很大，把 Map 查找塞進 template 會更難讀也更難驗。
 */
import type { AttendancePlan, Child, ClassGroup, ClassTopic } from '../types'

/** `聚會日|班別` → 主題文字。服事頁每張班別卡都要查，先建索引比逐筆 find 快也好讀 */
export function topicIndex(topics: ClassTopic[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of topics) {
    const topic = t.topic.trim()
    if (topic) m.set(`${t.gathering_date}|${t.class_group_id}`, topic)
  }
  return m
}

export function topicAt(
  index: Map<string, string>,
  gatheringDate: string,
  classGroupId: string,
): string {
  return index.get(`${gatheringDate}|${classGroupId}`) ?? ''
}

export interface ClassPlanCount {
  class_group_id: string
  name: string
  attending: number
}

/**
 * 某個聚會日各班「家長已勾出席」的人數（v16 #2）。
 *
 * 老師要能提早知道那天大概多少孩子會來，才好準備材料與分組。
 * 資料與權限本來就有（`plans_read` 允許同工讀全部、`listPlansRange` 也早就寫好），
 * 缺的只是畫面上的入口。
 *
 * 只算 `attending`：`leave`（請假）與 `undecided`（未定）都不是「會來」。
 * 孩子的班別以**現在的班別**為準——升班後舊紀錄跟著新班走，這裡是給老師預備用的前瞻資訊，
 * 不是歷史統計，用現況比較合用。
 *
 * 回傳只包含**有人出席的班別**，且照 `groups` 的順序；
 * 全班掛零就不列，免得卡片上掛一排「0 人」的雜訊。
 */
export function attendingByClass(
  plans: AttendancePlan[],
  children: Child[],
  groups: ClassGroup[],
  gatheringDate: string,
): ClassPlanCount[] {
  // Child.class_group_id 的型別是 number | string（歷史遺留），統一轉字串再比對
  const classOf = new Map(children.map((c) => [c.id, String(c.class_group_id)]))
  const tally = new Map<string, number>()
  for (const p of plans) {
    if (p.gathering_date !== gatheringDate || p.status !== 'attending') continue
    const cls = classOf.get(p.child_id)
    if (!cls) continue // 孩子已被刪除或看不到，不猜
    tally.set(cls, (tally.get(cls) ?? 0) + 1)
  }
  return groups
    .filter((g) => (tally.get(g.id) ?? 0) > 0)
    .map((g) => ({ class_group_id: g.id, name: g.name, attending: tally.get(g.id) ?? 0 }))
}

/** 提示列文字：「兒童班 10、幼童班 5」；沒人填就回空字串讓畫面整行不顯示 */
export function attendingSummary(counts: ClassPlanCount[]): string {
  return counts.map((c) => `${c.name} ${c.attending}`).join('、')
}

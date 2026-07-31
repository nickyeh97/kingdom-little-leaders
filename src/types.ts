export type UserRole = 'admin' | 'teacher' | 'parent'
export type AttendanceStatus = 'attending' | 'leave' | 'undecided'

export interface Profile {
  id: string
  display_name: string
  /** 角色標籤集合：可同時為 admin + teacher + parent */
  roles: UserRole[]
  /** 審核制：管理者核准後才開通角色功能；未審核僅能看公告與帳號設定 */
  approved: boolean
  auth_provider: string
  phone: string | null
  created_at: string
}

export interface ClassGroup {
  id: string
  name: string
  sort_order: number
}

export interface Child {
  id: string
  name: string
  class_group_id: number | string
  level: string | null
  class_groups?: ClassGroup
}

export interface AttendancePlan {
  id: string
  child_id: string
  gathering_date: string
  status: AttendanceStatus
  /** 家長給老師的話（選填） */
  note: string | null
  updated_by: string
}

/** 當日簽到狀態：出席 / 臨時請假 */
export type CheckInStatus = 'present' | 'leave'

export interface CheckIn {
  id: string
  child_id: string
  /** 點名所屬班別（跨班現場加入時＝加入的班） */
  class_group_id: string
  gathering_date: string
  status: CheckInStatus
  /** 老師交接備註：僅老師可見，不對家長端顯示 */
  note: string | null
  is_walk_in: boolean
  checked_by: string
}

/** 課堂表現回饋：老師以表情向家長說明課堂情況（取代成績） */
export interface SessionFeedback {
  id: string
  child_id: string
  gathering_date: string
  moods: string[]
  created_by: string
}

/** 專心度/配合度（v4 決議 2）：1–5、僅老師/同工可讀；幼幼班不評 */
export interface PerformanceScore {
  child_id: string
  gathering_date: string
  focus: number | null
  cooperation: number | null
}

/** 家長端出席勾勾（parent_checkin_marks RPC 回傳；不含老師備註） */
export interface CheckInMark {
  child_id: string
  gathering_date: string
  status: CheckInStatus
}

/** 課堂紀錄：每班每聚會日一筆（日期、老師、教學內容、詩歌進度、課後反饋） */
export interface SessionLog {
  id: string
  class_group_id: string
  gathering_date: string
  teacher_id: string
  teacher_name: string
  content: string
  song_progress: string
  feedback: string
  updated_at: string
}

/** 敬拜詩歌曲庫：影音外連 YouTube（youtube_url＝連結·純歌詞、dance_url＝連結·有動作） */
export interface Song {
  id: string
  title: string
  youtube_url: string | null
  dance_url: string | null
  lyrics: string | null
  created_at: string
  /** 巢狀查詢帶回的各班熟悉度 */
  song_familiarity?: SongFamiliarity[]
}

/** 歌單期間（班別 × 期間，如「2026年7-8月」雙月歌單；欄位依現行共編 Excel） */
export interface SongPlaylist {
  id: string
  class_group_id: string
  title: string
  start_date: string
  end_date: string
  playlist_songs?: { song_id: string; sort_order: number; songs?: Song }[]
}

/** 兩維熟悉度（班別 × 歌曲；1–5：1＝不熟、5＝熟悉；含填寫人/填寫日期/上課日期） */
export interface SongFamiliarity {
  song_id: string
  class_group_id: string
  song_level: number | null
  motion_level: number | null
  last_practiced_on: string | null
  updated_by_name: string
  updated_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  tag: string
  /** 班別歸屬：null＝全體公告（v3 決議 4） */
  class_group_id: string | null
  class_groups?: { name: string } | null
  pinned: boolean
  created_by: string
  created_at: string
}

/** 每週各班服事內容（C-01：日期/詩歌/主題/彈性時間；發布後老師可見） */
export interface ServiceWeek {
  id: string
  gathering_date: string
  class_group_id: string
  songs_text: string
  topic: string
  flex_text: string
  published: boolean
  service_assignments?: ServiceAssignment[]
}

/** 老師服事報名（T-COM-01；teacher_name 為快照） */
export interface TeacherServiceSignup {
  id: string
  teacher_id: string
  teacher_name: string
  gathering_date: string
  class_group_id: string
  item: string
  note: string | null
}

/** 排班結果（C-01b） */
export interface ServiceAssignment {
  id: string
  service_week_id: string
  teacher_id: string | null
  teacher_name: string
  item: string
  sort_order: number
}

export type UserRole = 'admin' | 'teacher' | 'parent'
export type AttendanceStatus = 'attending' | 'leave' | 'undecided'

export interface Profile {
  id: string
  display_name: string
  /** 角色標籤集合：可同時為 admin + teacher + parent */
  roles: UserRole[]
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

/** 敬拜歌單的歌曲：每聚會日一組，影音外連 YouTube */
export interface Song {
  id: string
  gathering_date: string
  title: string
  youtube_url: string | null
  lyrics: string | null
  sort_order: number
}

export interface Announcement {
  id: string
  title: string
  body: string
  tag: string
  pinned: boolean
  created_by: string
  created_at: string
}

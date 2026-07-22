export type UserRole = 'admin' | 'teacher' | 'parent'
export type AttendanceStatus = 'attending' | 'leave' | 'undecided'

export interface Profile {
  id: string
  display_name: string
  role: UserRole
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
  sunday_date: string
  status: AttendanceStatus
  updated_by: string
}

export interface CheckIn {
  id: string
  child_id: string
  sunday_date: string
  is_walk_in: boolean
  checked_by: string
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

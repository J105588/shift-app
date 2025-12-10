export type Profile = {
    id: string
    display_name: string | null
    role: 'admin' | 'staff'
    email?: string | null
  }
  
  // 旧構造（後方互換性のため保持）
  export type Shift = {
    id: string
    user_id: string
    title: string
    start_time: string
    end_time: string
    supervisor_id?: string | null
    profiles?: Profile
    supervisor?: Profile
    description?: string | null
    color?: string | null
  }
  
  // 新構造: シフトグループ（業務枠）
  export type ShiftGroup = {
    id: string
    title: string
    start_time: string
    end_time: string
    description?: string | null
    location?: string | null
    color?: string | null
    created_at: string
    updated_at: string
  }
  
  // 新構造: シフト割り当て（参加者）
  export type ShiftAssignment = {
    id: string
    shift_group_id: string
    user_id: string
    is_supervisor: boolean
    created_at: string
    profiles?: Profile
  }
  
  // シフトグループと参加者を結合した型
  export type ShiftGroupWithAssignments = ShiftGroup & {
    assignments: ShiftAssignment[]
    supervisor?: Profile
    member_count?: number
  }
  
  // カレンダー表示用
  export type CalendarEvent = {
    id: string
    title: string
    start: Date
    end: Date
    resourceId: string // user_id or shift_group_id
    color?: string
    shiftGroupId?: string // 新構造用
    isGroupShift?: boolean // 団体付与かどうか
  }
  
  // グループチャットメッセージ
  export type ShiftGroupChatMessage = {
    id: string
    shift_group_id: string
    user_id: string
    message: string
    image_url?: string | null
    created_at: string
    reply_to?: string | null
    profiles?: Profile
    reply_to_message?: ShiftGroupChatMessage | null // リプライ先のメッセージ（JOINで取得）
    read_receipts?: ShiftGroupChatReadReceipt[] // 既読情報
  }

export type ShiftGroupChatReadReceipt = {
    message_id: string
    user_id: string
    created_at: string
    profiles?: Profile
}
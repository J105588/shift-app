export type Profile = {
    id: string
    display_name: string | null
    role: 'admin' | 'staff'
  }
  
  export type Shift = {
    id: string
    user_id: string
    title: string
    start_time: string
    end_time: string
    profiles?: Profile
  }
  
  // カレンダー表示用
  export type CalendarEvent = {
    id: string
    title: string
    start: Date
    end: Date
    resourceId: string // user_id
    color?: string
  }
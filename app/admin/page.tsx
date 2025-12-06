'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import ShiftModal from '@/components/ShiftModal'
import UserManagement from '@/components/UserManagement' 
import AdminCalendar from '@/components/AdminCalendar'
import SpreadsheetView from '@/components/SpreadsheetView'
import AdminNotifications from '@/components/AdminNotifications'
import AdminSettings from '@/components/AdminSettings'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format } from 'date-fns/format'
import { parse } from 'date-fns/parse'
import { startOfWeek } from 'date-fns/startOfWeek'
import { getDay } from 'date-fns/getDay'
import { ja } from 'date-fns/locale/ja'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Users, Calendar as CalIcon, Table2, Settings } from 'lucide-react'
import { Profile, Shift } from '@/lib/types'
import { RefreshCw } from 'lucide-react'
import FcmTokenManager from '@/components/FcmTokenManager'

// 動的レンダリングを強制（Supabase認証が必要なため）
export const dynamic = 'force-dynamic'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'ja': ja } })

export default function AdminPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [activeTab, setActiveTab] = useState<'calendar' | 'users' | 'notifications' | 'settings'>('calendar')
  const [calendarView, setCalendarView] = useState<'calendar' | 'spreadsheet'>('calendar')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedShift, setSelectedShift] = useState<any>(null)

  const fetchShifts = async () => {
    try {
      // シフトデータを取得（統括者情報も含む）
      // まずは基本的なクエリで試す（supervisor_idが存在しない場合のエラーを避けるため）
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('*, profiles!shifts_user_id_fkey(display_name)')
      
      if (shiftsError) {
        console.error('シフト取得エラー:', shiftsError)
        // supervisor_idカラムが存在しない場合は、基本的なクエリのみ使用
        const { data: basicData, error: basicError } = await supabase
          .from('shifts')
          .select('*, profiles(display_name)')
        
        if (basicError) {
          console.error('基本シフト取得エラー:', basicError)
          return
        }
        
        if (basicData) {
          const formatted = basicData.map((s: any) => ({
            id: s.id,
            title: `${s.profiles?.display_name}: ${s.title}`,
            start: new Date(s.start_time),
            end: new Date(s.end_time),
            resource: s 
          }))
          setEvents(formatted)
          setShifts(basicData as Shift[])
        }
      } else if (shiftsData) {
        // supervisor情報も取得を試みる
        const shiftsWithSupervisor = await Promise.all(
          shiftsData.map(async (shift: any) => {
            if (shift.supervisor_id) {
              const { data: supervisorData } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', shift.supervisor_id)
                .single()
              return { ...shift, supervisor: supervisorData }
            }
            return shift
          })
        )
        
        // カレンダー用のイベントデータ
        const formatted = shiftsWithSupervisor.map((s: any) => ({
          id: s.id,
          title: `${s.profiles?.display_name}: ${s.title}`,
          start: new Date(s.start_time),
          end: new Date(s.end_time),
          resource: s 
        }))
        setEvents(formatted)
        setShifts(shiftsWithSupervisor as Shift[])
      }

      // ユーザー一覧を取得
      const { data: usersData } = await supabase.from('profiles').select('*').order('display_name')
      if (usersData) {
        setUsers(usersData as Profile[])
      }
    } catch (error) {
      console.error('fetchShiftsエラー:', error)
    }
  }

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.href = '/'
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data?.role !== 'admin') return window.location.href = '/dashboard'
      
      setUser(user)
      setProfile(data)
      fetchShifts()
    }
    checkAdmin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 定期的にメンテナンスモードをチェック（管理者はメンテナンス中でもアクセス可能だが、チェックは必要）
  useEffect(() => {
    if (!user || !profile || profile?.role !== 'admin') return

    const checkMaintenanceMode = async () => {
      try {
        const { data: maintenanceSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single()

        // 管理者はメンテナンス中でもアクセス可能なので、リダイレクトはしない
        // ただし、メンテナンスモードの状態を把握するためにチェックは継続
        const isMaintenanceMode = maintenanceSetting?.value === 'true'
        // 必要に応じて、メンテナンスモードの状態を表示するなどの処理を追加可能
      } catch (error) {
        console.error('メンテナンスモードチェックエラー:', error)
      }
    }

    // 初回チェック
    checkMaintenanceMode()

    // 5秒ごとにチェック
    const interval = setInterval(checkMaintenanceMode, 5000)

    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile])

  // shiftsテーブルの変更をリアルタイムで監視し、画面とDBを同期
  useEffect(() => {
    const channel = supabase
      .channel('public:shifts_admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          fetchShifts()
        }
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedShift(null)
    setSelectedDate(start)
    setIsModalOpen(true)
  }

  // AdminCalendar用のラッパー（Dateを直接受け取る）
  const handleSelectSlotForMobile = (start: Date) => {
    handleSelectSlot({ start })
  }

  const handleSelectEvent = (event: any) => {
    setSelectedShift(event.resource)
    setIsModalOpen(true)
  }

  if (!profile) return null

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar user={user} profile={profile} />
      <FcmTokenManager userId={user?.id || ''} />
      
      {/* タブナビゲーション - モバイル対応 */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex gap-2 sm:gap-3">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 touch-manipulation ${
              activeTab === 'calendar' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-slate-50'
            }`}
          >
            <CalIcon size={18} /> 
            <span className="hidden sm:inline">シフト管理</span>
            <span className="sm:hidden">シフト</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 touch-manipulation ${
              activeTab === 'users' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-slate-50'
            }`}
          >
            <Users size={18} /> 
            <span className="hidden sm:inline">ユーザー管理</span>
            <span className="sm:hidden">ユーザー</span>
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 touch-manipulation ${
              activeTab === 'notifications' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-slate-50'
            }`}
          >
            <RefreshCw size={18} /> 
            <span className="hidden sm:inline">通知</span>
            <span className="sm:hidden">通知</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 touch-manipulation ${
              activeTab === 'settings' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 bg-slate-50'
            }`}
          >
            <Settings size={18} /> 
            <span className="hidden sm:inline">設定</span>
            <span className="sm:hidden">設定</span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto pb-20 space-y-4">
        {activeTab === 'calendar' ? (
          <div className="h-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 overflow-hidden">
            <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-slate-200">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <CalIcon className="text-blue-600" size={20} />
                    シフト管理
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {calendarView === 'calendar' 
                      ? '日付をクリックして追加、シフトをクリックして編集'
                      : '全ユーザーのシフトを一覧表示'}
                  </p>
                </div>
                {/* ビュー切り替えボタン */}
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setCalendarView('calendar')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded transition-all ${
                      calendarView === 'calendar'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <CalIcon size={16} className="inline mr-1" />
                    カレンダー
                  </button>
                  <button
                    onClick={() => setCalendarView('spreadsheet')}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded transition-all ${
                      calendarView === 'spreadsheet'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Table2 size={16} className="inline mr-1" />
                    表形式
                  </button>
                </div>
              </div>
            </div>
            
            {calendarView === 'calendar' ? (
              <>
                {/* デスクトップ: react-big-calendar */}
                <div className="hidden md:block h-[calc(100vh-280px)] min-h-[500px]">
                  <Calendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    defaultView={Views.WEEK}
                    views={[Views.MONTH, Views.WEEK, Views.DAY]}
                    culture='ja'
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    messages={{ next: "次", previous: "前", today: "今日", month: "月", week: "週", day: "日" }}
                  />
                </div>
                {/* モバイル: カスタムカレンダー */}
                <div className="md:hidden">
                  <AdminCalendar
                    events={events}
                    onSelectSlot={handleSelectSlotForMobile}
                    onSelectEvent={handleSelectEvent}
                  />
                </div>
              </>
            ) : (
              <div className="overflow-x-auto">
                <SpreadsheetView
                  shifts={shifts}
                  users={users}
                  onShiftClick={(shift) => {
                    setSelectedShift(shift)
                    setIsModalOpen(true)
                  }}
                />
              </div>
            )}
          </div>
        ) : activeTab === 'users' ? (
          <div className="h-full overflow-y-auto">
            <UserManagement />
          </div>
        ) : activeTab === 'notifications' ? (
          <div className="h-full overflow-y-auto">
            <AdminNotifications />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <AdminSettings userId={user?.id || null} />
          </div>
        )}
      </main>

      <ShiftModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchShifts}
        initialDate={selectedDate}
        editShift={selectedShift}
      />
    </div>
  )
}
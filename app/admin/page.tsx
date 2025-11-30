'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import ShiftModal from '@/components/ShiftModal'
import UserManagement from '@/components/UserManagement' // 後で作ります
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format } from 'date-fns/format'
import { parse } from 'date-fns/parse'
import { startOfWeek } from 'date-fns/startOfWeek'
import { getDay } from 'date-fns/getDay'
import { ja } from 'date-fns/locale/ja'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Users, Calendar as CalIcon } from 'lucide-react'

// 動的レンダリングを強制（Supabase認証が必要なため）
export const dynamic = 'force-dynamic'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'ja': ja } })

export default function AdminPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'calendar' | 'users'>('calendar')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedShift, setSelectedShift] = useState<any>(null)

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
  }, [])

  const fetchShifts = async () => {
    const { data } = await supabase.from('shifts').select('*, profiles(display_name)')
    if (data) {
      const formatted = data.map((s: any) => ({
        id: s.id,
        title: `${s.profiles?.display_name}: ${s.title}`,
        start: new Date(s.start_time),
        end: new Date(s.end_time),
        resource: s 
      }))
      setEvents(formatted)
    }
  }

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedShift(null)
    setSelectedDate(start)
    setIsModalOpen(true)
  }

  const handleSelectEvent = (event: any) => {
    setSelectedShift(event.resource)
    setIsModalOpen(true)
  }

  if (!profile) return null

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar user={user} profile={profile} />
      
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
            <span className="hidden sm:inline">スタッフ管理</span>
            <span className="sm:hidden">スタッフ</span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto pb-20">
        {activeTab === 'calendar' ? (
          <div className="h-full bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4 md:p-6 overflow-hidden">
            <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-slate-200">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <CalIcon className="text-blue-600" size={20} />
                シフトカレンダー
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">日付をクリックして追加、シフトをクリックして編集</p>
            </div>
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
            {/* モバイル: 簡易リスト表示 */}
            <div className="md:hidden space-y-3">
              {events.length === 0 ? (
                <div className="text-center py-12">
                  <CalIcon className="mx-auto text-slate-300 mb-4" size={48} />
                  <p className="text-slate-500 font-medium">シフトが登録されていません</p>
                  <p className="text-sm text-slate-400 mt-2">デスクトップでカレンダーから追加できます</p>
                </div>
              ) : (
                events
                  .sort((a, b) => a.start.getTime() - b.start.getTime())
                  .map((event: any) => (
                    <div
                      key={event.id}
                      onClick={() => handleSelectEvent(event)}
                      className="bg-white border-2 border-slate-200 rounded-lg p-4 active:scale-95 transition-all cursor-pointer touch-manipulation"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-bold text-slate-900 text-base mb-1">
                            {event.title}
                          </div>
                          <div className="text-sm text-slate-600">
                            {format(event.start, 'M/d(E) HH:mm', { locale: ja })} 〜 {format(event.end, 'HH:mm', { locale: ja })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <UserManagement />
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
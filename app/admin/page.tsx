'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import ShiftModal from '@/components/ShiftModal'
import UserManagement from '@/components/UserManagement'
import { Calendar, dateFnsLocalizer, Views, View } from 'react-big-calendar'
import { format } from 'date-fns/format'
import { parse } from 'date-fns/parse'
import { startOfWeek } from 'date-fns/startOfWeek'
import { getDay } from 'date-fns/getDay'
import { ja } from 'date-fns/locale/ja'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Users, Calendar as CalIcon } from 'lucide-react'

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

  // ビューの切り替え（モバイル対応）
  const [view, setView] = useState<View>(Views.WEEK)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setView(Views.AGENDA)
      } else {
        setView(Views.WEEK)
      }
    }

    // 初期チェック
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    <div className="flex flex-col h-screen bg-slate-50">
      <Navbar user={user} profile={profile} />

      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'calendar'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <CalIcon size={18} />
            <span className="hidden sm:inline">シフト管理</span>
            <span className="sm:hidden">シフト</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <Users size={18} />
            <span className="hidden sm:inline">スタッフ管理</span>
            <span className="sm:hidden">スタッフ</span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-2 sm:p-6 overflow-hidden">
        {activeTab === 'calendar' ? (
          <div className="h-full bg-white rounded-lg shadow-sm border border-slate-200 p-2 sm:p-6 overflow-hidden flex flex-col">
            <div className="mb-2 sm:mb-4 pb-2 sm:pb-4 border-b border-slate-200 flex-none">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <CalIcon className="text-blue-600" size={24} />
                シフトカレンダー
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">日付をクリックして追加、シフトをクリックして編集</p>
            </div>
            <div className="flex-1 min-h-0">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                view={view}
                onView={setView}
                views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                culture='ja'
                selectable
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                messages={{ next: "次", previous: "前", today: "今日", month: "月", week: "週", day: "日", agenda: "リスト" }}
              />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-hidden">
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
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
    <div className="flex flex-col h-screen bg-gradient-to-br from-rose-50 via-pink-50/50 to-fuchsia-50/50">
      <Navbar user={user} profile={profile} />
      
      <div className="bg-white/70 backdrop-blur-sm border-b border-pink-100/50 px-6 py-3 shadow-sm">
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'calendar' 
                ? 'bg-gradient-to-r from-rose-300/80 to-pink-300/80 text-rose-700 shadow-sm border border-pink-200/50' 
                : 'text-rose-600/70 hover:bg-rose-50/50 hover:text-rose-700'
            }`}
          >
            <CalIcon size={18} /> 
            <span className="hidden sm:inline">シフト管理</span>
            <span className="sm:hidden">シフト</span>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'users' 
                ? 'bg-gradient-to-r from-rose-300/80 to-pink-300/80 text-rose-700 shadow-sm border border-pink-200/50' 
                : 'text-rose-600/70 hover:bg-rose-50/50 hover:text-rose-700'
            }`}
          >
            <Users size={18} /> 
            <span className="hidden sm:inline">スタッフ管理</span>
            <span className="sm:hidden">スタッフ</span>
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 sm:p-6 overflow-hidden">
        {activeTab === 'calendar' ? (
          <div className="h-full bg-white/70 backdrop-blur-sm rounded-2xl shadow-md border border-pink-100/50 p-4 sm:p-6 overflow-hidden">
            <div className="mb-4 pb-4 border-b border-pink-100/50">
              <h2 className="text-xl font-semibold text-rose-700 flex items-center gap-2">
                <CalIcon className="text-rose-500" size={24} />
                シフトカレンダー
              </h2>
              <p className="text-sm text-rose-500/70 mt-1">日付をクリックして追加、シフトをクリックして編集</p>
            </div>
            <div className="h-[calc(100%-100px)]">
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
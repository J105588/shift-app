'use client'
import { useEffect, useState } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format } from 'date-fns/format'
import { parse } from 'date-fns/parse'
import { startOfWeek } from 'date-fns/startOfWeek'
import { getDay } from 'date-fns/getDay'
import { ja } from 'date-fns/locale/ja'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Clock } from 'lucide-react'

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'ja': ja } })

export default function Dashboard() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [nextShift, setNextShift] = useState<any>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.href = '/'
      setUser(user)
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)

      // シフト取得
      const { data: shifts } = await supabase.from('shifts').select('*, profiles(display_name)')
      if (shifts) {
        const formatted = shifts.map((s: any) => ({
          id: s.id,
          title: `${s.profiles?.display_name}: ${s.title}`,
          start: new Date(s.start_time),
          end: new Date(s.end_time),
          resourceId: s.user_id,
        }))
        setEvents(formatted)

        // 自分の次のシフトを探す
        const now = new Date()
        const myShifts = formatted
          .filter((e: any) => e.resourceId === user.id && e.start > now)
          .sort((a: any, b: any) => a.start.getTime() - b.start.getTime())
        
        if (myShifts.length > 0) setNextShift(myShifts[0])
      }
    }
    init()
  }, [])

  if (!profile) return <div className="p-10 text-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} profile={profile} />
      
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ウェルカムカード */}
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                こんにちは、{profile.display_name}さん
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">今日も1日頑張りましょう！</p>
            </div>
            
            {nextShift ? (
              <div className="bg-blue-50 border-2 border-blue-200 px-6 py-4 rounded-lg flex items-center gap-4 w-full lg:w-auto">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Clock size={28} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">次のシフト</div>
                  <div className="font-bold text-slate-900 text-lg">
                    {format(nextShift.start, 'M/d(E) HH:mm', { locale: ja })} 〜
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{nextShift.title.split(': ')[1]}</div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 px-6 py-4 rounded-lg border-2 border-slate-200 text-slate-600 text-sm font-medium">
                予定されているシフトはありません
              </div>
            )}
          </div>
        </div>

        {/* カレンダー */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-200 h-[600px] sm:h-[700px]">
          <div className="mb-4 pb-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">シフト一覧</h3>
          </div>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView={Views.AGENDA}
            views={[Views.MONTH, Views.AGENDA]}
            culture='ja'
            messages={{ next: "次", previous: "前", today: "今日", month: "月", week: "週", day: "日", agenda: "リスト" }}
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: event.resourceId === user.id ? '#3b82f6' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                padding: '4px 8px',
                color: 'white',
                fontWeight: '600'
              }
            })}
          />
        </div>
      </main>
    </div>
  )
}
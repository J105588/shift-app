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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50/50 to-fuchsia-50/50 flex flex-col">
      <Navbar user={user} profile={profile} />
      
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* ウェルカムカード */}
        <div className="bg-white/70 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-md border border-pink-100/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-rose-600 mb-2">
                こんにちは、{profile.display_name}さん
              </h2>
              <p className="text-rose-500/70 text-sm sm:text-base font-medium">今日も1日頑張りましょう！✨</p>
            </div>
            
            {nextShift ? (
              <div className="bg-gradient-to-r from-rose-200/60 to-pink-200/60 px-6 py-4 rounded-xl shadow-sm flex items-center gap-4 w-full lg:w-auto border border-pink-200/50">
                <div className="bg-white/50 backdrop-blur-sm p-3 rounded-xl">
                  <Clock size={28} className="text-rose-500" />
                </div>
                <div>
                  <div className="text-xs text-rose-600/80 font-semibold uppercase tracking-wider mb-1">次のシフト</div>
                  <div className="font-semibold text-rose-700 text-lg">
                    {format(nextShift.start, 'M/d(E) HH:mm', { locale: ja })} 〜
                  </div>
                  <div className="text-sm text-rose-600/70 mt-1">{nextShift.title.split(': ')[1]}</div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50/50 px-6 py-4 rounded-xl border border-pink-200/50 text-rose-500/70 text-sm font-medium">
                予定されているシフトはありません
              </div>
            )}
          </div>
        </div>

        {/* カレンダー */}
        <div className="bg-white/70 backdrop-blur-sm p-4 sm:p-6 rounded-2xl shadow-md border border-pink-100/50 h-[600px] sm:h-[700px]">
          <div className="mb-4 pb-4 border-b border-pink-100">
            <h3 className="text-lg font-semibold text-rose-600">シフト一覧</h3>
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
                backgroundColor: event.resourceId === user.id ? '#fda4af' : '#fbcfe8',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                padding: '4px 8px',
                color: event.resourceId === user.id ? '#881337' : '#831843'
              }
            })}
          />
        </div>
      </main>
    </div>
  )
}
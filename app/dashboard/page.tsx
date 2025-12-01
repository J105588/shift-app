'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns/format'
import { ja } from 'date-fns/locale/ja'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import ScheduleTimetable from '@/components/ScheduleTimetable'
import { Clock } from 'lucide-react'

// 動的レンダリングを強制（Supabase認証が必要なため）
export const dynamic = 'force-dynamic'

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
      console.log('[Dashboard] Logged-in user:', user)
      console.log('[Dashboard] Loaded profile:', profile)
      setProfile(profile)

      // シフト取得（全シフトを取得してからクライアント側で本人の分だけに絞り込む）
      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('*, profiles!shifts_user_id_fkey(display_name)')
        .order('start_time', { ascending: true })

      if (shiftsError) {
        console.error('[Dashboard] Error fetching shifts:', shiftsError)
      }

      if (shifts) {
        console.log('[Dashboard] Raw shifts fetched (count):', shifts.length)
        console.log('[Dashboard] Raw shifts sample (first 5):', shifts.slice(0, 5))
        const formatted = shifts.map((s: any) => ({
          id: s.id,
          title: `${s.profiles?.display_name || '不明'}: ${s.title}`,
          start: new Date(s.start_time),
          end: new Date(s.end_time),
          resourceId: s.user_id,
          displayName: s.profiles?.display_name || '不明',
          shiftTitle: s.title,
        }))
        console.log('[Dashboard] Formatted events sample (first 5):', formatted.slice(0, 5))
        
        // 自分のシフトだけを画面に表示
        const myEvents = formatted.filter((e: any) => e.resourceId === user.id)
        console.log('[Dashboard] Current user id:', user.id)
        console.log('[Dashboard] Filtered events for current user (count):', myEvents.length)
        console.log('[Dashboard] Filtered events sample (first 5):', myEvents.slice(0, 5))
        setEvents(myEvents)

        // 自分の次のシフトを探す
        const now = new Date()
        const myShifts = myEvents
          .filter((e: any) => e.start > now)
          .sort((a: any, b: any) => a.start.getTime() - b.start.getTime())
        
        if (myShifts.length > 0) setNextShift(myShifts[0])
      }
    }
    init()
  }, [])

  if (!profile || !user) return <div className="p-10 text-center">読み込み中...</div>

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
                  <div className="text-sm text-slate-600 mt-1">{nextShift.shiftTitle || nextShift.title}</div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 px-6 py-4 rounded-lg border-2 border-slate-200 text-slate-600 text-sm font-medium">
                予定されているシフトはありません
              </div>
            )}
          </div>
        </div>

        {/* タイムテーブル */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <ScheduleTimetable
            events={events}
            currentUserId={user.id}
          />
        </div>
      </main>
    </div>
  )
}
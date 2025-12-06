'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns/format'
import { ja } from 'date-fns/locale/ja'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ScheduleTimetable from '@/components/ScheduleTimetable'
import ShiftDetailModal from '@/components/ShiftDetailModal'
import { Clock } from 'lucide-react'
import FcmTokenManager from '@/components/FcmTokenManager'

// 動的レンダリングを強制（Supabase認証が必要なため）
export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [nextShift, setNextShift] = useState<any>(null)
  const [rawShifts, setRawShifts] = useState<any[]>([])
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [coworkers, setCoworkers] = useState<any[]>([])
  const [supervisorName, setSupervisorName] = useState<string | null>(null)

  const loadShiftsForUser = async (currentUser: any) => {
    const allRawShifts: any[] = []
    const allFormatted: any[] = []

    // 1. 既存のshiftsテーブルから個別付与シフトを取得（後方互換性）
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*, profiles!shifts_user_id_fkey(display_name)')
      .order('start_time', { ascending: true })

    if (shifts) {
      allRawShifts.push(...shifts)
      shifts.forEach((s: any) => {
        allFormatted.push({
          id: s.id,
          title: `${s.profiles?.display_name || '不明'}: ${s.title}`,
          start: new Date(s.start_time),
          end: new Date(s.end_time),
          resourceId: s.user_id,
          displayName: s.profiles?.display_name || '不明',
          shiftTitle: s.title,
          description: s.description,
          supervisor_id: s.supervisor_id,
          user_id: s.user_id,
          isGroupShift: false
        })
      })
    }

    // 2. shift_groupsから自分が参加している団体付与シフトを取得
    const { data: myAssignments } = await supabase
      .from('shift_assignments')
      .select('*, shift_groups!shift_assignments_shift_group_id_fkey(*)')
      .eq('user_id', currentUser.id)
    
    if (myAssignments) {
      for (const assignment of myAssignments) {
        const group = assignment.shift_groups
        if (!group) continue
        
        // 同じshift_groupの全参加者を取得
        const { data: allAssignments } = await supabase
          .from('shift_assignments')
          .select('*, profiles!shift_assignments_user_id_fkey(display_name)')
          .eq('shift_group_id', group.id)
        
        if (allAssignments) {
          // 統括者を取得
          const supervisor = allAssignments.find((a: any) => a.is_supervisor)
          const isSupervisor = assignment.is_supervisor
          const memberCount = allAssignments.length
          
          // rawShiftsに追加（詳細表示用）
          allRawShifts.push({
            ...group,
            isGroupShift: true,
            assignments: allAssignments,
            supervisor_id: supervisor?.user_id || null,
            user_id: currentUser.id // 自分が参加している
          })
          
          // カレンダー用のイベントデータ
          allFormatted.push({
            id: group.id,
            title: `${group.title}${isSupervisor ? '（統括）' : ''}`,
            start: new Date(group.start_time),
            end: new Date(group.end_time),
            resourceId: currentUser.id,
            displayName: currentUser.display_name || '不明',
            shiftTitle: group.title,
            description: group.description,
            supervisor_id: supervisor?.user_id || null,
            user_id: currentUser.id,
            isGroupShift: true,
            isSupervisor: isSupervisor,
            memberCount: memberCount,
            assignments: allAssignments
          })
        }
      }
    }

    setRawShifts(allRawShifts)
    
    // 自分のシフトを取得（個別付与）
    const myOwnEvents = allFormatted.filter((e: any) => 
      !e.isGroupShift && e.resourceId === currentUser.id
    )
    
    // 統括者として設定されているシフトを取得（個別付与）
    const supervisorEvents = allFormatted.filter((e: any) => 
      !e.isGroupShift && e.supervisor_id === currentUser.id
    )
    
    // 統括者として設定されているシフトの重複を除去
    const uniqueSupervisorEvents: any[] = []
    const seenKeys = new Set<string>()
    
    supervisorEvents.forEach((event: any) => {
      const key = `${event.start.getTime()}-${event.end.getTime()}-${event.shiftTitle}-${event.description || ''}`
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        uniqueSupervisorEvents.push(event)
      }
    })
    
    // 団体付与シフト（自分が参加しているもの）
    const groupEvents = allFormatted.filter((e: any) => e.isGroupShift)
    
    // すべてを結合
    const myEvents = [...myOwnEvents, ...uniqueSupervisorEvents, ...groupEvents]
    setEvents(myEvents)

    // 現在時刻
    const now = new Date()
    
    // 進行中のシフトを探す（開始時刻 <= 現在時刻 <= 終了時刻）
    // 自分のシフト（個別付与）のみを対象
    const myOwnShifts = myEvents.filter((e: any) => 
      !e.isGroupShift && e.resourceId === currentUser.id
    )
    const currentShifts = myOwnShifts.filter((e: any) => {
      return e.start <= now && e.end >= now
    })
    
    // 自分の次のシフトを探す（現在時刻より後のシフト、個別付与と団体付与の両方）
    const myShifts = myEvents
      .filter((e: any) => e.start > now)
      .sort((a: any, b: any) => a.start.getTime() - b.start.getTime())
    
    // 進行中のシフトがあればそれを優先、なければ次のシフト
    if (currentShifts.length > 0) {
      setNextShift({ ...currentShifts[0], isCurrent: true })
    } else if (myShifts.length > 0) {
      setNextShift({ ...myShifts[0], isCurrent: false })
    } else {
      setNextShift(null)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return window.location.href = '/'
      
      // メンテナンスモードをチェック
      const { data: maintenanceSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single()

      const isMaintenanceMode = maintenanceSetting?.value === 'true'

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      
      // メンテナンスモードが有効で、一般ユーザーの場合はメンテナンスページへリダイレクト（ログアウトしない）
      if (isMaintenanceMode && profile?.role !== 'admin') {
        router.replace('/maintenance')
        return
      }

      setUser(user)
      setProfile(profile)

      await loadShiftsForUser(user)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 定期的にメンテナンスモードをチェック
  useEffect(() => {
    if (!user || !profile) return

    const checkMaintenanceMode = async () => {
      try {
        const { data: maintenanceSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single()

        const isMaintenanceMode = maintenanceSetting?.value === 'true'

        // メンテナンスモードが有効で、一般ユーザーの場合はメンテナンスページへリダイレクト（ログアウトしない）
        if (isMaintenanceMode && profile?.role !== 'admin') {
          router.replace('/maintenance')
        }
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
    if (!user) return

    const channel = supabase
      .channel('public:shifts_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => {
          loadShiftsForUser(user)
        }
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // 定期的に最新データを取得（30秒ごと、Realtimeの補完として）
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      loadShiftsForUser(user)
    }, 30000) // 30秒ごと

    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleEventClick = async (event: any) => {
    if (!user || rawShifts.length === 0) return

    setSelectedEvent(event)

    // 団体付与シフトの場合
    if (event.isGroupShift) {
      const shiftGroup = rawShifts.find((s: any) => s.id === event.id && s.isGroupShift)
      if (shiftGroup && shiftGroup.assignments) {
        // 参加メンバー全員を取得
        const coworkersList = shiftGroup.assignments.map((a: any) => ({
          id: a.user_id,
          displayName: a.profiles?.display_name || '不明',
          isCurrentUser: a.user_id === user.id,
          isSupervisor: a.is_supervisor
        }))

        setCoworkers(coworkersList)

        // 統括者名の取得
        const supervisor = shiftGroup.assignments.find((a: any) => a.is_supervisor)
        setSupervisorName(supervisor?.profiles?.display_name || null)
      } else {
        // shift_group_idから直接取得
        const { data: assignments } = await supabase
          .from('shift_assignments')
          .select('*, profiles!shift_assignments_user_id_fkey(display_name)')
          .eq('shift_group_id', event.id)
        
        if (assignments) {
          const coworkersList = assignments.map((a: any) => ({
            id: a.user_id,
            displayName: a.profiles?.display_name || '不明',
            isCurrentUser: a.user_id === user.id,
            isSupervisor: a.is_supervisor
          }))
          setCoworkers(coworkersList)
          
          const supervisor = assignments.find((a: any) => a.is_supervisor)
          setSupervisorName(supervisor?.profiles?.display_name || null)
        }
      }
    } else {
      // 個別付与シフトの場合（既存のロジック）
      const sameJobShifts = rawShifts.filter((s: any) => {
        if (s.isGroupShift) return false
        const sameTitle = s.title === (event.shiftTitle || event.title)
        const sameStart = new Date(s.start_time).getTime() === event.start.getTime()
        const sameEnd = new Date(s.end_time).getTime() === event.end.getTime()
        return sameTitle && sameStart && sameEnd
      })

      const coworkersList = sameJobShifts.map((s: any) => ({
        id: s.user_id,
        displayName: s.profiles?.display_name || '不明',
        isCurrentUser: s.user_id === user.id,
      }))

      setCoworkers(coworkersList)

      // 統括者名の取得（あれば）
      const supervisorId = sameJobShifts[0]?.supervisor_id
      if (supervisorId) {
        const { data: supervisorProfile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', supervisorId)
          .single()
        setSupervisorName(supervisorProfile?.display_name || null)
      } else {
        setSupervisorName(null)
      }
    }

    setIsDetailOpen(true)
  }

  if (!profile || !user) return <div className="p-10 text-center">読み込み中...</div>

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} profile={profile} />
      <FcmTokenManager userId={user?.id || ''} />
      
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
              <div className={`${nextShift.isCurrent ? 'bg-red-50 border-2 border-red-200' : 'bg-blue-50 border-2 border-blue-200'} px-4 sm:px-6 py-4 rounded-lg flex items-center gap-3 sm:gap-4 w-full lg:w-auto`}>
                <div className={`${nextShift.isCurrent ? 'bg-red-100' : 'bg-blue-100'} p-2 sm:p-3 rounded-lg flex-shrink-0`}>
                  <Clock size={24} className={`${nextShift.isCurrent ? 'text-red-600' : 'text-blue-600'} sm:w-7 sm:h-7`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${nextShift.isCurrent ? 'text-red-600' : 'text-blue-600'} font-semibold uppercase tracking-wider mb-1`}>
                    {nextShift.isCurrent ? '進行中のシフト' : '次のシフト'}
                  </div>
                  <div className={`font-bold text-slate-900 text-base sm:text-lg truncate`}>
                    {format(nextShift.start, 'M/d(E) HH:mm', { locale: ja })} 〜 {format(nextShift.end, 'HH:mm', { locale: ja })}
                  </div>
                  <div className={`text-sm ${nextShift.isCurrent ? 'text-red-700' : 'text-slate-600'} mt-1 truncate`}>
                    {nextShift.shiftTitle || nextShift.title}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 px-4 sm:px-6 py-4 rounded-lg border-2 border-slate-200 text-slate-600 text-sm font-medium w-full lg:w-auto">
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
            onEventClick={handleEventClick}
          />
        </div>
      </main>

      <ShiftDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        shift={
          selectedEvent
            ? {
                id: selectedEvent.id,
                title: selectedEvent.shiftTitle || selectedEvent.title,
                start: selectedEvent.start,
                end: selectedEvent.end,
                description: selectedEvent.description,
                supervisor_id: selectedEvent.supervisor_id,
                isGroupShift: selectedEvent.isGroupShift || false,
                shiftGroupId: selectedEvent.isGroupShift ? selectedEvent.id : undefined,
              }
            : null
        }
        coworkers={coworkers}
        supervisorName={supervisorName}
        currentUserId={user?.id}
        onDescriptionUpdated={() => {
          // シフト情報を再取得
          if (user) {
            loadShiftsForUser(user)
          }
        }}
      />
    </div>
  )
}
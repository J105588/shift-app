'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import GroupChat from '@/components/GroupChat'
import Navbar from '@/components/Navbar'

// 動的レンダリングを強制（Supabase認証が必要なため）
export const dynamic = 'force-dynamic'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const shiftGroupId = params.shiftGroupId as string
  
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [shiftGroup, setShiftGroup] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        // ユーザー認証を確認
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
          router.replace('/')
          return
        }

        // プロフィールを取得
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single()

        if (!profileData) {
          router.replace('/')
          return
        }

        setUser(currentUser)
        setProfile(profileData)

        // シフトグループ情報を取得
        const { data: groupData } = await supabase
          .from('shift_groups')
          .select('*')
          .eq('id', shiftGroupId)
          .single()

        if (!groupData) {
          alert('シフトグループが見つかりません')
          router.back()
          return
        }

        // このシフトグループに参加しているか確認（管理者はスキップ）
        if (profileData.role !== 'admin') {
          const { data: assignment } = await supabase
            .from('shift_assignments')
            .select('*')
            .eq('shift_group_id', shiftGroupId)
            .eq('user_id', currentUser.id)
            .single()

          if (!assignment) {
            alert('このシフトグループに参加していません')
            router.back()
            return
          }
        }

        setShiftGroup(groupData)
        setIsAuthorized(true)
      } catch (error) {
        console.error('初期化エラー:', error)
        alert('エラーが発生しました')
        router.back()
      } finally {
        setIsLoading(false)
      }
    }

    if (shiftGroupId) {
      init()
    }
  }, [shiftGroupId, router, supabase])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!isAuthorized || !shiftGroup || !user) {
    return null
  }

  const shiftStartTime = new Date(shiftGroup.start_time)
  const shiftEndTime = new Date(shiftGroup.end_time)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} profile={profile} />
      
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">戻る</span>
          </button>
          
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              {shiftGroup.title}
            </h1>
            <p className="text-sm text-slate-600">
              {shiftStartTime.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })} {' '}
              {shiftStartTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 〜 {' '}
              {shiftEndTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* チャットコンポーネント */}
        <GroupChat
          shiftGroupId={shiftGroupId}
          currentUserId={user.id}
          currentUserRole={profile.role}
          shiftEndTime={shiftEndTime}
          shiftTitle={shiftGroup.title}
          shiftStartTime={shiftStartTime}
        />
      </div>
    </div>
  )
}


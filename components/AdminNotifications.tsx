'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/lib/types'
import { Bell, Send, Users, UserCheck } from 'lucide-react'

type ShiftGroup = {
  id: string
  title: string
  start_time: string
  end_time: string
  groupName: string // 生成されたグループ名
  memberCount: number
}

type UserGroup = {
  name: string
  memberCount: number
}

export default function AdminNotifications() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [shiftGroups, setShiftGroups] = useState<ShiftGroup[]>([])
  const [userGroups, setUserGroups] = useState<UserGroup[]>([])
  const [selectedUserGroupNames, setSelectedUserGroupNames] = useState<string[]>([])
  const [mode, setMode] = useState<'users' | 'groups' | 'user_groups'>('users')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  // グループ名を生成する関数
  const generateGroupName = (startTime: string, endTime: string, title: string): string => {
    // UTC時刻をローカル時刻に変換
    const start = new Date(startTime)
    const end = new Date(endTime)

    // 日付: MMDD形式（例: 0921）
    const month = String(start.getMonth() + 1).padStart(2, '0')
    const day = String(start.getDate()).padStart(2, '0')
    const dateStr = `${month}${day}`

    // 時間: HHMM-HHMM形式（例: 1100-1230）
    const startHour = String(start.getHours()).padStart(2, '0')
    const startMin = String(start.getMinutes()).padStart(2, '0')
    const endHour = String(end.getHours()).padStart(2, '0')
    const endMin = String(end.getMinutes()).padStart(2, '0')
    const timeStr = `${startHour}${startMin}-${endHour}${endMin}`

    // グループ名: 日付-時間-仕事名
    return `${dateStr}-${timeStr}-${title}`
  }

  useEffect(() => {
    const load = async () => {
      // ユーザー一覧を取得
      const { data: usersData } = await supabase.from('profiles').select('*').order('display_name')
      if (usersData) {
        setUsers(usersData as Profile[])

        // ユーザーグループを集計
        const groupCounts = new Map<string, number>()
        usersData.forEach((u: Profile) => {
          if (u.group_name) {
            groupCounts.set(u.group_name, (groupCounts.get(u.group_name) || 0) + 1)
          }
        })
        const groups: UserGroup[] = Array.from(groupCounts.entries()).map(([name, count]) => ({
          name,
          memberCount: count
        })).sort((a, b) => a.name.localeCompare(b.name))
        setUserGroups(groups)
      }

      // 団体シフト（未終了）を取得
      const now = new Date().toISOString()
      const { data: groupsData } = await supabase
        .from('shift_groups')
        .select('*')
        .gt('end_time', now) // 終了時刻が現在より後のもののみ
        .order('start_time', { ascending: true })

      if (groupsData) {
        // 各グループの参加者数を取得
        const groupsWithCounts = await Promise.all(
          groupsData.map(async (group) => {
            const { data: assignments } = await supabase
              .from('shift_assignments')
              .select('user_id')
              .eq('shift_group_id', group.id)

            const groupName = generateGroupName(group.start_time, group.end_time, group.title)

            return {
              id: group.id,
              title: group.title,
              start_time: group.start_time,
              end_time: group.end_time,
              groupName,
              memberCount: assignments?.length || 0
            }
          })
        )

        setShiftGroups(groupsWithCounts)
      } else {
        setShiftGroups([])
      }
    }
    load()

    // リアルタイム更新: shift_groupsとshift_assignmentsの変更を監視
    const channel = supabase
      .channel('admin_notifications_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_groups' },
        () => {
          load()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shift_assignments' },
        () => {
          load()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          load()
        }
      )
      .subscribe()

    // 定期的に更新（30秒ごと、リアルタイム更新の補完として）
    const interval = setInterval(load, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [supabase])

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleUserGroup = (name: string) => {
    setSelectedUserGroupNames((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    )
  }

  const handleSelectAll = () => {
    if (mode === 'users') {
      if (selectedUserIds.length === users.length) {
        setSelectedUserIds([])
      } else {
        setSelectedUserIds(users.map((u) => u.id))
      }
    } else if (mode === 'user_groups') {
      if (selectedUserGroupNames.length === userGroups.length) {
        setSelectedUserGroupNames([])
      } else {
        setSelectedUserGroupNames(userGroups.map((g) => g.name))
      }
    } else {
      if (selectedGroupIds.length === shiftGroups.length) {
        setSelectedGroupIds([])
      } else {
        setSelectedGroupIds(shiftGroups.map((g) => g.id))
      }
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    // 二重送信防止
    if (isSending) {
      return
    }

    if (!title || !title.trim()) {
      alert('タイトルを入力してください')
      return
    }
    if (!body || !body.trim()) {
      alert('内容を入力してください')
      return
    }

    setIsSending(true)
    try {
      const nowIso = new Date().toISOString()
      let targetUserIds: string[] = []

      if (mode === 'users') {
        if (selectedUserIds.length === 0) {
          alert('少なくとも1人の宛先を選択してください')
          setIsSending(false)
          return
        }
        targetUserIds = selectedUserIds
      } else if (mode === 'user_groups') {
        // ユーザーグループ選択モード
        if (selectedUserGroupNames.length === 0) {
          alert('少なくとも1つ等のグループを選択してください')
          setIsSending(false)
          return
        }

        targetUserIds = users
          .filter(u => u.group_name && selectedUserGroupNames.includes(u.group_name))
          .map(u => u.id)

        if (targetUserIds.length === 0) {
          alert('選択したグループに参加者がいません')
          setIsSending(false)
          return
        }
      } else {
        // グループ選択モード
        if (selectedGroupIds.length === 0) {
          alert('少なくとも1つのグループを選択してください')
          setIsSending(false)
          return
        }

        // 選択されたグループの全参加者を取得
        for (const groupId of selectedGroupIds) {
          const { data: assignments } = await supabase
            .from('shift_assignments')
            .select('user_id')
            .eq('shift_group_id', groupId)

          if (assignments) {
            const userIds = assignments.map(a => a.user_id)
            targetUserIds = [...targetUserIds, ...userIds]
          }
        }

        // 重複を除去
        targetUserIds = [...new Set(targetUserIds)]

        if (targetUserIds.length === 0) {
          alert('選択したグループに参加者がいません')
          setIsSending(false)
          return
        }
      }

      // 即時送信用ジョブを作成（scheduled_at は現在時刻）
      const payloads = targetUserIds.map((userId) => ({
        target_user_id: userId,
        title: title.trim(), // 前後の空白を削除
        body: body.trim(), // 前後の空白を削除
        scheduled_at: nowIso,
      }))

      const { error } = await supabase.from('notifications').insert(payloads)
      if (error) throw error

      const recipientText = mode === 'users'
        ? `${selectedUserIds.length}人`
        : `${selectedGroupIds.length}グループ（${targetUserIds.length}人）`

      alert(`通知ジョブを作成しました（${recipientText}宛、ログイン中の端末に順次配信されます）。`)
      setTitle('')
      setBody('')
      setSelectedUserIds([]) // 選択をリセット
      setSelectedGroupIds([]) // 選択をリセット
      setSelectedUserGroupNames([]) // 選択をリセット
    } catch (err) {
      console.error('通知作成エラー:', err)
      alert('通知の作成に失敗しました: ' + ((err as Error).message || '詳細不明'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-blue-100">
          <Bell className="text-blue-600" size={20} />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">プッシュ通知</h2>
          <p className="text-sm text-slate-700">
            タイトルと内容を指定して、選択したユーザーのログイン中の端末に通知を送ります。
          </p>
        </div>
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            タイトル
          </label>
          <input
            type="text"
            className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 本日のシフトのお知らせ"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            内容
          </label>
          <textarea
            className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm min-h-[100px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="例: 10:00〜12:00 受付シフトの方は9:45に集合してください。"
          />
        </div>

        {/* モード選択 */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <label className="block text-sm font-semibold text-slate-700 mb-3">配信先選択</label>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setMode('users')
                setSelectedGroupIds([])
                setSelectedUserGroupNames([])
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg font-semibold transition-all ${mode === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <UserCheck size={18} />
              ユーザー選択
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('user_groups')
                setSelectedUserIds([])
                setSelectedGroupIds([])
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg font-semibold transition-all ${mode === 'user_groups'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <Users size={18} />
              グループ選択
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('groups')
                setSelectedUserIds([])
                setSelectedUserGroupNames([])
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg font-semibold transition-all ${mode === 'groups'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <Users size={18} />
              シフト選択
            </button>
          </div>
        </div>

        {/* ユーザー選択モード */}
        {mode === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                宛先ユーザー
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {selectedUserIds.length === users.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
            <div className="border-2 border-slate-200 rounded-lg max-h-64 overflow-y-auto bg-slate-50 p-2 space-y-1">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded"
                    checked={selectedUserIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  <span className="text-slate-900">{u.display_name}</span>
                </label>
              ))}
            </div>
            {selectedUserIds.length > 0 && (
              <p className="text-sm text-slate-700 mt-1">
                {selectedUserIds.length}人を選択中
              </p>
            )}
          </div>
        )}

        {/* ユーザーグループ選択モード */}
        {mode === 'user_groups' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                宛先グループ（ユーザー属性）
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {selectedUserGroupNames.length === userGroups.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
            {userGroups.length === 0 ? (
              <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50 text-center">
                <p className="text-sm text-slate-500">
                  現在、所属グループが設定されているユーザーがいません
                </p>
              </div>
            ) : (
              <>
                <div className="border-2 border-slate-200 rounded-lg max-h-64 overflow-y-auto bg-slate-50 p-2 space-y-1">
                  {userGroups.map((group) => (
                    <label
                      key={group.name}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded"
                        checked={selectedUserGroupNames.includes(group.name)}
                        onChange={() => toggleUserGroup(group.name)}
                      />
                      <div className="flex-1">
                        <span className="text-slate-900 font-medium">{group.name}</span>
                        <span className="text-sm text-slate-600 ml-2">
                          （{group.memberCount}名）
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedUserGroupNames.length > 0 && (
                  <p className="text-sm text-slate-700 mt-1">
                    {selectedUserGroupNames.length}グループを選択中
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* グループ選択モード */}
        {mode === 'groups' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                宛先シフト（シフト終了前のもののみ表示）
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {selectedGroupIds.length === shiftGroups.length ? 'すべて解除' : 'すべて選択'}
              </button>
            </div>
            {shiftGroups.length === 0 ? (
              <div className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50 text-center">
                <p className="text-sm text-slate-500">
                  現在、配信可能な団体シフトがありません
                </p>
              </div>
            ) : (
              <>
                <div className="border-2 border-slate-200 rounded-lg max-h-64 overflow-y-auto bg-slate-50 p-2 space-y-1">
                  {shiftGroups.map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 border-2 border-slate-300 rounded"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                      />
                      <div className="flex-1">
                        <span className="text-slate-900 font-medium">{group.groupName}</span>
                        <span className="text-sm text-slate-600 ml-2">
                          （{group.memberCount}名）
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedGroupIds.length > 0 && (
                  <p className="text-sm text-slate-700 mt-1">
                    {selectedGroupIds.length}グループを選択中
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send size={16} />
                通知を送信
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}



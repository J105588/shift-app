'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Shift } from '@/lib/types'
import { X, Users, UserCheck, Copy, UserCog } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  initialDate?: Date
  editShift?: Shift | null
}

export default function ShiftModal({ isOpen, onClose, onSaved, initialDate, editShift }: Props) {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [mode, setMode] = useState<'individual' | 'group'>('individual') // 個別付与 or 団体付与
  const [individualMode, setIndividualMode] = useState<'single' | 'multiple'>('single') // 個別付与内のモード
  const [titleMode, setTitleMode] = useState<'same' | 'individual'>('same')
  const [supervisorId, setSupervisorId] = useState<string>('') // 団体付与時の統括者
  const [formData, setFormData] = useState({
    user_id: '',
    title: '',
    start: '',
    end: '',
    supervisor_id: '',
    description: '',
    location: '' // 場所（将来の拡張用）
  })
  const [individualTitles, setIndividualTitles] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [useTemplate, setUseTemplate] = useState(true)

  // よく使う仕事内容のテンプレート
  const jobTemplates = [
    '受付',
    '案内',
    '販売',
    '会計',
    '準備',
    '片付け',
    '休憩',
    '統括',
    'サポート',
    'その他'
  ]

  // 初期化とユーザー一覧取得
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('*')
      if (data) setUsers(data as Profile[])
    }
    if (isOpen) fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // フォーム初期値設定
  useEffect(() => {
    if (editShift) {
      // 編集モード: 個別付与モード（既存のシフトを編集）
      setMode('individual')
      setIndividualMode('single')
      setFormData({
        user_id: editShift.user_id,
        title: editShift.title,
        start: new Date(editShift.start_time).toISOString().slice(0, 16),
        end: new Date(editShift.end_time).toISOString().slice(0, 16),
        supervisor_id: editShift.supervisor_id || '',
        description: editShift.description || '',
        location: ''
      })
      setSelectedUserIds([])
      setSupervisorId('')
      setIndividualTitles({})
      setUseTemplate(jobTemplates.includes(editShift.title))
    } else if (initialDate) {
      // 新規作成モード（クリックした日付をセット）
      setMode('group') // デフォルトで団体付与モード
      setIndividualMode('single')
      const start = new Date(initialDate)
      start.setHours(9, 0, 0, 0) // デフォルト9時
      const end = new Date(start)
      end.setHours(12, 0, 0, 0) // デフォルト12時
      
      const offset = start.getTimezoneOffset() * 60000
      const localStart = new Date(start.getTime() - offset).toISOString().slice(0, 16)
      const localEnd = new Date(end.getTime() - offset).toISOString().slice(0, 16)

      setFormData({ user_id: '', title: '受付', start: localStart, end: localEnd, supervisor_id: '', description: '', location: '' })
      setSelectedUserIds([])
      setSupervisorId('')
      setIndividualTitles({})
      setUseTemplate(true)
    }
  }, [editShift, initialDate, isOpen])

  // シフトに関連する通知を作成するヘルパー関数
  // shiftIdはshift_groupsのIDまたはshiftsのIDのいずれか
  // isGroupShift: trueの場合はshift_group_idを使用、falseの場合はshift_idを使用
  const createShiftNotifications = async (shiftId: string, userId: string, title: string, startTime: string, endTime: string, isGroupShift: boolean = false) => {
    const start = new Date(startTime)
    const end = new Date(endTime)
    
    // シフト開始時刻が過去の場合は通知を作成しない
    if (start.getTime() <= Date.now()) {
      return
    }

    // 通知タイミング（1時間前、30分前、5分前）
    const reminderMinutes = [60, 30, 5]
    const reminders = reminderMinutes
      .map((minutes) => {
        const scheduled = new Date(start.getTime() - minutes * 60 * 1000)
        // 過去の時刻の通知は作成しない
        if (scheduled.getTime() <= Date.now()) {
          return null
        }
        const notification: any = {
          target_user_id: userId,
          title: 'シフトのご案内',
          body: `${start.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}〜${end.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit',
          })}「${title}」のシフトが${minutes}分後に開始します。`,
          scheduled_at: scheduled.toISOString(),
        }
        
        // shift_groupsの場合はshift_group_id、shiftsの場合はshift_idを使用
        if (isGroupShift) {
          notification.shift_group_id = shiftId
        } else {
          notification.shift_id = shiftId
        }
        
        return notification
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (reminders.length > 0) {
      await supabase.from('notifications').insert(reminders)
    }
  }

  // シフトに関連する通知を削除するヘルパー関数
  // isGroupShift: trueの場合はshift_group_idを使用、falseの場合はshift_idを使用
  const deleteShiftNotifications = async (shiftId: string, isGroupShift: boolean = false) => {
    // 未送信の通知のみ削除（既に送信済みの通知は保持）
    if (isGroupShift) {
      await supabase
        .from('notifications')
        .delete()
        .eq('shift_group_id', shiftId)
        .is('sent_at', null)
    } else {
      await supabase
        .from('notifications')
        .delete()
        .eq('shift_id', shiftId)
        .is('sent_at', null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 重複シフトチェック（新規作成・複数作成時のみ）
      if (!editShift) {
        const targetUserIds =
          mode === 'group' || (mode === 'individual' && individualMode === 'multiple')
            ? selectedUserIds
            : formData.user_id
            ? [formData.user_id]
            : []

        if (targetUserIds.length > 0 && formData.start && formData.end) {
          const startIso = new Date(formData.start).toISOString()
          const endIso = new Date(formData.end).toISOString()

          const overlapLines: string[] = []

          // 1. 個別付与シフト（shiftsテーブル）との重複チェック
          const { data: shiftsOverlaps, error: shiftsOverlapError } = await supabase
            .from('shifts')
            .select('*, profiles!shifts_user_id_fkey(display_name)')
            .in('user_id', targetUserIds)
            .lt('start_time', endIso)
            .gt('end_time', startIso)

          if (shiftsOverlapError) {
            console.warn('重複シフトチェック中のエラー（shifts）:', shiftsOverlapError)
          }

          if (shiftsOverlaps && shiftsOverlaps.length > 0) {
            shiftsOverlaps.forEach((s: any) => {
              const start = new Date(s.start_time)
              const end = new Date(s.end_time)
              const timeStr = `${start.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}〜${end.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}`
              const name = s.profiles?.display_name || '不明'
              overlapLines.push(`・${name}：${timeStr}「${s.title}」（個別付与）`)
            })
          }

          // 2. 団体付与シフト（shift_assignments）との重複チェック
          const { data: assignmentsOverlaps, error: assignmentsOverlapError } = await supabase
            .from('shift_assignments')
            .select(`
              *,
              shift_groups!shift_assignments_shift_group_id_fkey(*),
              profiles!shift_assignments_user_id_fkey(display_name)
            `)
            .in('user_id', targetUserIds)

          if (assignmentsOverlapError) {
            console.warn('重複シフトチェック中のエラー（shift_assignments）:', assignmentsOverlapError)
          }

          if (assignmentsOverlaps && assignmentsOverlaps.length > 0) {
            assignmentsOverlaps.forEach((a: any) => {
              const group = a.shift_groups
              if (!group) return
              
              const groupStart = new Date(group.start_time)
              const groupEnd = new Date(group.end_time)
              
              // 時間が重なっているかチェック
              if (groupStart.getTime() < new Date(endIso).getTime() && 
                  groupEnd.getTime() > new Date(startIso).getTime()) {
                const timeStr = `${groupStart.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}〜${groupEnd.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
                const name = a.profiles?.display_name || '不明'
                overlapLines.push(`・${name}：${timeStr}「${group.title}」（団体付与）`)
              }
            })
          }

          if (overlapLines.length > 0) {
            const proceed = window.confirm(
              `以下のユーザーは、この時間帯にすでにシフトが入っています。\n\n${overlapLines.join(
                '\n'
              )}\n\nそれでも新しいシフトを作成しますか？`
            )

            if (!proceed) {
              setIsSubmitting(false)
              return
            }
          }
        }
      }

      if (editShift) {
        // 編集モード: 既存のシフトを更新（後方互換性のためshiftsテーブルを使用）
        if (!formData.user_id) {
          alert('担当者を選択してください')
          setIsSubmitting(false)
          return
        }

        const payload: any = {
          user_id: formData.user_id,
          title: formData.title,
          start_time: new Date(formData.start).toISOString(),
          end_time: new Date(formData.end).toISOString(),
          description: formData.description || null,
        }
        if (formData.supervisor_id && formData.supervisor_id.trim() !== '') {
          payload.supervisor_id = formData.supervisor_id
        }

        const { error } = await supabase.from('shifts').update(payload).eq('id', editShift.id)
        if (error) {
          console.error('シフト更新エラー:', error)
          throw error
        }

        await deleteShiftNotifications(editShift.id)
        await createShiftNotifications(
          editShift.id,
          formData.user_id,
          formData.title,
          payload.start_time,
          payload.end_time
        )
      } else if (mode === 'group') {
        // 団体付与モード: shift_groupsとshift_assignmentsを使用
        if (selectedUserIds.length === 0) {
          alert('少なくとも1人の参加者を選択してください')
          setIsSubmitting(false)
          return
        }

        if (!supervisorId) {
          alert('統括者を選択してください')
          setIsSubmitting(false)
          return
        }

        if (!formData.title) {
          alert('業務内容を入力してください')
          setIsSubmitting(false)
          return
        }

        // 1. shift_groupを作成
        const { data: shiftGroup, error: groupError } = await supabase
          .from('shift_groups')
          .insert({
            title: formData.title,
            start_time: new Date(formData.start).toISOString(),
            end_time: new Date(formData.end).toISOString(),
            description: formData.description || null,
            location: formData.location || null,
          })
          .select()
          .single()

        if (groupError) {
          console.error('シフトグループ作成エラー:', groupError)
          throw groupError
        }

        // 2. shift_assignmentsを作成（全参加者）
        const assignments = selectedUserIds.map(userId => ({
          shift_group_id: shiftGroup.id,
          user_id: userId,
          is_supervisor: userId === supervisorId,
        }))

        const { error: assignmentError } = await supabase
          .from('shift_assignments')
          .insert(assignments)

        if (assignmentError) {
          console.error('シフト割り当て作成エラー:', assignmentError)
          // ロールバック: shift_groupを削除
          await supabase.from('shift_groups').delete().eq('id', shiftGroup.id)
          throw assignmentError
        }

        // 3. 通知を作成（各参加者に対して）
        for (const userId of selectedUserIds) {
          await createShiftNotifications(
            shiftGroup.id,
            userId,
            formData.title,
            shiftGroup.start_time,
            shiftGroup.end_time,
            true // shift_groupsを使用
          )
        }
      } else if (mode === 'individual' && individualMode === 'single') {
        // 単一ユーザーモード
        if (!formData.user_id) {
          alert('担当者を選択してください')
          setIsSubmitting(false)
          return
        }

        const payload: any = {
          user_id: formData.user_id,
          title: formData.title,
          start_time: new Date(formData.start).toISOString(),
          end_time: new Date(formData.end).toISOString(),
          description: formData.description || null,
        }
        // supervisor_idが空文字列でない場合のみ追加
        if (formData.supervisor_id && formData.supervisor_id.trim() !== '') {
          payload.supervisor_id = formData.supervisor_id
        }

        const { data: inserted, error } = await supabase.from('shifts').insert([payload]).select()
        if (error) {
          console.error('シフト挿入エラー:', error)
          throw error
        }
        // シフト作成時: 通知を作成
        if (inserted && inserted[0]) {
          const s = inserted[0] as any
          await createShiftNotifications(
            s.id,
            s.user_id,
            s.title,
            s.start_time,
            s.end_time
          )
        }
      } else if (mode === 'individual' && individualMode === 'multiple') {
        // 個別付与モード（複数人一括）: 既存のshiftsテーブルを使用（後方互換性）
        if (selectedUserIds.length === 0) {
          alert('少なくとも1人のユーザーを選択してください')
          setIsSubmitting(false)
          return
        }

        if (titleMode === 'same' && !formData.title) {
          alert('業務内容を入力してください')
          setIsSubmitting(false)
          return
        }

        if (titleMode === 'individual') {
          const missingTitles = selectedUserIds.filter(userId => !individualTitles[userId] || individualTitles[userId].trim() === '')
          if (missingTitles.length > 0) {
            const userNames = missingTitles.map(id => users.find(u => u.id === id)?.display_name).filter(Boolean).join('、')
            alert(`以下のユーザーの業務内容が未入力です: ${userNames}`)
            setIsSubmitting(false)
            return
          }
        }

        const payloads = selectedUserIds.map(userId => {
          const payload: any = {
            user_id: userId,
            title: titleMode === 'same' 
              ? formData.title 
              : (individualTitles[userId] || formData.title),
            start_time: new Date(formData.start).toISOString(),
            end_time: new Date(formData.end).toISOString(),
            description: formData.description || null,
          }
          // supervisor_idが空文字列でない場合のみ追加
          if (formData.supervisor_id && formData.supervisor_id.trim() !== '') {
            payload.supervisor_id = formData.supervisor_id
          }
          return payload
        })

        const { data: inserted, error } = await supabase.from('shifts').insert(payloads).select()
        if (error) {
          console.error('シフト一括挿入エラー:', error)
          throw error
        }
        // 作成された各シフトに対して通知を作成
        if (inserted && inserted.length > 0) {
          for (const s of inserted) {
            await createShiftNotifications(
              s.id,
              s.user_id,
              s.title,
              s.start_time,
              s.end_time
            )
          }
        }
      }

      onSaved()
      onClose()
    } catch (error: any) {
      console.error('シフト保存エラー:', error)
      const errorMessage = error.message || error.details || 'シフトの保存に失敗しました'
      alert(`エラー: ${errorMessage}\n\n詳細: ${JSON.stringify(error, null, 2)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUserToggle = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
    // 個別タイトルモードの場合、新規選択ユーザーにデフォルトタイトルを設定
    if (titleMode === 'individual' && !selectedUserIds.includes(userId)) {
      setIndividualTitles(prev => ({
        ...prev,
        [userId]: formData.title || '受付'
      }))
    }
  }

  const handleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([])
      setIndividualTitles({})
    } else {
      const allIds = users.map(u => u.id)
      setSelectedUserIds(allIds)
      if (titleMode === 'individual') {
        const titles: Record<string, string> = {}
        allIds.forEach(id => {
          titles[id] = individualTitles[id] || formData.title || '受付'
        })
        setIndividualTitles(titles)
      }
    }
  }

  const handleDelete = async () => {
    if (!editShift || !confirm('本当に削除しますか？')) return
    
    // シフト削除時: 関連する未送信通知を削除（shift_idのCASCADE削除で自動削除されるが、明示的に削除）
    await deleteShiftNotifications(editShift.id)
    
    const { error } = await supabase.from('shifts').delete().eq('id', editShift.id)
    if (!error) {
      onSaved()
      onClose()
    } else {
      alert('シフトの削除に失敗しました: ' + error.message)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-2xl shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[95vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-600 p-4 sm:p-5 flex justify-between items-center flex-shrink-0">
          <h2 className="font-bold text-lg sm:text-xl text-white">{editShift ? 'シフト編集' : 'シフト追加'}</h2>
          <button 
            onClick={onClose}
            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200 touch-manipulation"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-white overflow-y-auto flex-1">
          {/* モード選択（編集時は表示しない） */}
          {!editShift && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">付与モード</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('individual')
                    setIndividualMode('single')
                    setSelectedUserIds([])
                    setSupervisorId('')
                    setFormData({...formData, user_id: ''})
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    mode === 'individual'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck size={18} />
                  個別付与
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('group')
                    setSelectedUserIds([])
                    setSupervisorId('')
                    setFormData({...formData, user_id: ''})
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    mode === 'group'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Users size={18} />
                  団体付与
                </button>
              </div>
              
              {/* 個別付与モード内のサブモード選択 */}
              {mode === 'individual' && (
                <div className="flex gap-2 pt-2 border-t border-blue-300">
                  <button
                    type="button"
                    onClick={() => {
                      setIndividualMode('single')
                      setSelectedUserIds([])
                      setFormData({...formData, user_id: ''})
                    }}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                      individualMode === 'single'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    1人ずつ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIndividualMode('multiple')
                      setFormData({...formData, user_id: ''})
                    }}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                      individualMode === 'multiple'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    複数人一括
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ユーザー選択 */}
          {(mode === 'individual' && individualMode === 'single') || editShift ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">担当者</label>
              <select 
                className="w-full border-2 border-slate-200 p-3 sm:p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base touch-manipulation"
                value={formData.user_id}
                onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                required
              >
                <option value="">選択してください</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
            </div>
          ) : mode === 'group' ? (
            <div className="space-y-4">
              {/* 参加者選択 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-slate-700">参加者を選択</label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    {selectedUserIds.length === users.length ? 'すべて解除' : 'すべて選択'}
                  </button>
                </div>
                <div className="border-2 border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50">
                  {users.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">ユーザーが登録されていません</p>
                  ) : (
                    <div className="space-y-2">
                      {users.map(u => (
                        <label
                          key={u.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => handleUserToggle(u.id)}
                            className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="flex-1 text-sm font-medium text-slate-900">{u.display_name}</span>
                          {selectedUserIds.includes(u.id) && (
                            <span className="text-xs text-blue-600 font-semibold">✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* 統括者選択 */}
              {selectedUserIds.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    統括者を選択 <span className="text-red-600">*</span>
                  </label>
                  <div className="border-2 border-slate-200 rounded-lg p-3 bg-slate-50">
                    {selectedUserIds.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-2">まず参加者を選択してください</p>
                    ) : (
                      <div className="space-y-2">
                        {users
                          .filter(u => selectedUserIds.includes(u.id))
                          .map(u => (
                            <label
                              key={u.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                            >
                              <input
                                type="radio"
                                name="supervisor"
                                value={u.id}
                                checked={supervisorId === u.id}
                                onChange={(e) => setSupervisorId(e.target.value)}
                                className="w-5 h-5 text-blue-600 border-2 border-slate-300 focus:ring-2 focus:ring-blue-500"
                              />
                              <UserCog size={16} className="text-blue-600" />
                              <span className="flex-1 text-sm font-medium text-slate-900">{u.display_name}</span>
                              {supervisorId === u.id && (
                                <span className="text-xs text-blue-600 font-semibold">統括者</span>
                              )}
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-slate-700">担当者を選択</label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  {selectedUserIds.length === users.length ? 'すべて解除' : 'すべて選択'}
                </button>
              </div>
              <div className="border-2 border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50">
                {users.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">ユーザーが登録されていません</p>
                ) : (
                  <div className="space-y-2">
                    {users.map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => handleUserToggle(u.id)}
                          className="w-5 h-5 text-blue-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="flex-1 text-sm font-medium text-slate-900">{u.display_name}</span>
                        {selectedUserIds.includes(u.id) && (
                          <span className="text-xs text-blue-600 font-semibold">✓</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {selectedUserIds.length > 0 && (
                <p className="text-xs text-slate-600 mt-2">
                  {selectedUserIds.length}人を選択中
                </p>
              )}
            </div>
          )}

          {/* 業務内容設定 */}
          {mode === 'individual' && individualMode === 'multiple' && !editShift && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-3">業務内容の設定方法</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTitleMode('same')
                    setIndividualTitles({})
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    titleMode === 'same'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  全員同じ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitleMode('individual')
                    // 選択済みユーザーにデフォルトタイトルを設定
                    const titles: Record<string, string> = {}
                    selectedUserIds.forEach(id => {
                      titles[id] = individualTitles[id] || formData.title || '受付'
                    })
                    setIndividualTitles(titles)
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    titleMode === 'individual'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  個別設定
                </button>
              </div>
            </div>
          )}

          {/* 業務内容入力 */}
          {titleMode === 'same' || (mode === 'individual' && individualMode === 'single') || editShift || mode === 'group' ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                役割・内容{((mode === 'individual' && individualMode === 'multiple') || mode === 'group') && '（全員共通）'}
              </label>
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setUseTemplate(!useTemplate)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      useTemplate
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {useTemplate ? 'テンプレート' : '自由入力'}
                  </button>
                </div>
                {useTemplate ? (
                  <select
                    className="w-full border-2 border-slate-200 p-3 sm:p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
                    value={formData.title}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData({...formData, title: value})
                      if (value === 'その他') {
                        setUseTemplate(false)
                        setFormData({...formData, title: ''})
                      }
                    }}
                    required={(mode === 'individual' && individualMode === 'single') || !!editShift || titleMode === 'same' || mode === 'group'}
                  >
                    <option value="">選択してください</option>
                    {jobTemplates.map(template => (
                      <option key={template} value={template}>{template}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    className="w-full border-2 border-slate-200 p-3 sm:p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
                    placeholder="例: 受付、案内、販売など"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required={(mode === 'individual' && individualMode === 'single') || !!editShift || titleMode === 'same' || mode === 'group'}
                  />
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">各担当者の業務内容</label>
              <div className="space-y-3 border-2 border-slate-200 rounded-lg p-3 bg-slate-50 max-h-64 overflow-y-auto">
                {selectedUserIds.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">まずユーザーを選択してください</p>
                ) : (
                  selectedUserIds.map(userId => {
                    const user = users.find(u => u.id === userId)
                    return (
                      <div key={userId} className="bg-white p-3 rounded-lg border border-slate-200">
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                          {user?.display_name}
                        </label>
                        <input
                          type="text"
                          className="w-full border-2 border-slate-200 p-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-sm"
                          placeholder="例: 受付、案内、販売など"
                          value={individualTitles[userId] || ''}
                          onChange={(e) => setIndividualTitles({
                            ...individualTitles,
                            [userId]: e.target.value
                          })}
                          required
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* 仕事内容メモ */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              仕事内容のメモ（任意）
            </label>
            <textarea
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-sm min-h-[80px]"
              placeholder="例: 校門付近での案内、30分ごとに交代 など"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* 統括者選択（個別付与モードのみ） */}
          {mode !== 'group' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <UserCog size={16} className="text-blue-600" />
                統括者（任意）
              </label>
              <select 
                className="w-full border-2 border-slate-200 p-3 sm:p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base touch-manipulation"
                value={formData.supervisor_id}
                onChange={(e) => setFormData({...formData, supervisor_id: e.target.value})}
              >
                <option value="">統括者なし</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">このシフトの統括責任者を選択できます</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">開始日時</label>
              <input 
                type="datetime-local" 
                className="w-full border-2 border-slate-200 p-3 sm:p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base touch-manipulation"
                value={formData.start}
                onChange={(e) => setFormData({...formData, start: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">終了日時</label>
              <input 
                type="datetime-local" 
                className="w-full border-2 border-slate-200 p-3 sm:p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base touch-manipulation"
                value={formData.end}
                onChange={(e) => setFormData({...formData, end: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-white pb-2 sm:pb-0">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 text-white py-3 sm:py-3 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  {((mode === 'individual' && individualMode === 'multiple') || mode === 'group') ? '作成中...' : '保存中...'}
                </>
              ) : (
                <>
                  {((mode === 'individual' && individualMode === 'multiple') || mode === 'group') && selectedUserIds.length > 0 && (
                    <Copy size={16} />
                  )}
                  {mode === 'group' && selectedUserIds.length > 0
                    ? `団体シフトを作成（${selectedUserIds.length}名）`
                    : (mode === 'individual' && individualMode === 'multiple') && selectedUserIds.length > 0
                    ? `${selectedUserIds.length}件のシフトを作成`
                    : editShift
                    ? '保存'
                    : '作成'}
                </>
              )}
            </button>
            {editShift && (
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={isSubmitting}
                className="w-full sm:w-auto sm:px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 font-semibold transition-colors duration-200 border-2 border-red-200 hover:border-red-300 touch-manipulation min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                削除
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
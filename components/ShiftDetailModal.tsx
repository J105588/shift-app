'use client'
import { useState, useEffect } from 'react'
import { Clock, Users, UserCog, X, CalendarDays, Edit2, Save, MessageCircle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type ShiftDetail = {
  id: string
  title: string
  start: Date
  end: Date
  description?: string | null
  supervisor_id?: string | null
  isGroupShift?: boolean
  shiftGroupId?: string
}

type Coworker = {
  id: string
  displayName: string
  isCurrentUser: boolean
}

type Props = {
  isOpen: boolean
  onClose: () => void
  shift: ShiftDetail | null
  coworkers: Coworker[]
  supervisorName?: string | null
  currentUserId?: string | null
  onDescriptionUpdated?: () => void
}

export default function ShiftDetailModal({ 
  isOpen, 
  onClose, 
  shift, 
  coworkers, 
  supervisorName,
  currentUserId,
  onDescriptionUpdated
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [editedDescription, setEditedDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSupervisor, setIsSupervisor] = useState(false)

  // 統括者かどうかをチェック
  useEffect(() => {
    if (shift && currentUserId) {
      if (shift.isGroupShift && shift.shiftGroupId) {
        // 団体付与シフトの場合、shift_assignmentsから統括者を確認
        supabase
          .from('shift_assignments')
          .select('is_supervisor')
          .eq('shift_group_id', shift.shiftGroupId)
          .eq('user_id', currentUserId)
          .single()
          .then(({ data }) => {
            setIsSupervisor(data?.is_supervisor || false)
          })
      } else {
        // 個別付与シフトの場合
        setIsSupervisor(shift.supervisor_id === currentUserId)
      }
    } else {
      setIsSupervisor(false)
    }
  }, [shift, currentUserId, supabase])

  // 編集モード開始時に現在のdescriptionをセット
  useEffect(() => {
    if (isEditing && shift) {
      setEditedDescription(shift.description || '')
    }
  }, [isEditing, shift])

  if (!isOpen || !shift) return null

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (date: Date) =>
    date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

  const handleSaveDescription = async () => {
    if (!shift || !isSupervisor) return

    setIsSaving(true)
    try {
      if (shift.isGroupShift && shift.shiftGroupId) {
        // 団体付与シフトの場合、shift_groupsを更新
        const { error } = await supabase
          .from('shift_groups')
          .update({ description: editedDescription.trim() || null })
          .eq('id', shift.shiftGroupId)

        if (error) {
          console.error('メモ更新エラー:', error)
          alert('メモの更新に失敗しました: ' + error.message)
          return
        }
      } else {
        // 個別付与シフトの場合、shiftsを更新
        const { error } = await supabase
          .from('shifts')
          .update({ description: editedDescription.trim() || null })
          .eq('id', shift.id)

        if (error) {
          console.error('メモ更新エラー:', error)
          alert('メモの更新に失敗しました: ' + error.message)
          return
        }
      }

      setIsEditing(false)
      // 即座に最新データを取得
      if (onDescriptionUpdated) {
        onDescriptionUpdated()
      }
    } catch (error: any) {
      console.error('メモ更新エラー:', error)
      alert('メモの更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedDescription(shift.description || '')
  }

  const handleOpenChat = () => {
    if (shift.isGroupShift && shift.shiftGroupId) {
      // 新しいページでチャットを開く
      window.open(`/chat/${shift.shiftGroupId}`, '_blank')
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-blue-600 px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-white" size={20} />
            <h2 className="text-white font-bold text-base sm:text-lg">
              シフト詳細
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* 時間・タイトル */}
          <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock size={20} className="text-blue-700" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-600 mb-1">
                  {formatDate(shift.start)}
                </div>
                <div className="font-bold text-slate-900 text-base sm:text-lg">
                  {formatTime(shift.start)} 〜 {formatTime(shift.end)}
                </div>
                <div className="mt-2 text-sm font-semibold text-blue-900">
                  {shift.title}
                </div>
              </div>
            </div>
          </div>

          {/* 仕事内容メモ */}
          <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-slate-600">
                仕事内容のメモ
              </div>
              {isSupervisor && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                >
                  <Edit2 size={14} />
                  編集
                </button>
              )}
            </div>
            {isEditing && isSupervisor ? (
              <div className="space-y-2">
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="仕事内容のメモを入力してください"
                  className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm resize-none"
                  rows={4}
                  disabled={isSaving}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDescription}
                    disabled={isSaving}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        保存
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {shift.description || 'メモはありません'}
              </p>
            )}
          </div>

          {/* 統括 */}
          {supervisorName && (
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <UserCog size={16} className="text-blue-700" />
                <span className="text-xs font-semibold text-blue-700">
                  統括
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold text-blue-900">
                <span>{supervisorName}</span>
                {isSupervisor && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">
                    あなた
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 一緒のシフトのメンバー */}
          {coworkers.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-slate-700" />
                <span className="text-xs font-semibold text-slate-700">
                  一緒のシフトのメンバー
                </span>
              </div>
              <div className="space-y-1.5">
                {coworkers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-900">{c.displayName}</span>
                    {c.isCurrentUser && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">
                        あなた
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* グループチャット（団体シフトのみ） */}
          {shift.isGroupShift && shift.shiftGroupId && currentUserId && (
            <button
              onClick={handleOpenChat}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm shadow-sm"
            >
              <MessageCircle size={18} />
              <span>チャットページで開く</span>
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}



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
  const [mode, setMode] = useState<'single' | 'multiple'>('single')
  const [titleMode, setTitleMode] = useState<'same' | 'individual'>('same')
  const [formData, setFormData] = useState({
    user_id: '',
    title: '',
    start: '',
    end: '',
    supervisor_id: '',
    description: ''
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
      // 編集モード: 単一ユーザーモード
      setMode('single')
      setFormData({
        user_id: editShift.user_id,
        title: editShift.title,
        start: new Date(editShift.start_time).toISOString().slice(0, 16),
        end: new Date(editShift.end_time).toISOString().slice(0, 16),
        supervisor_id: editShift.supervisor_id || '',
        description: editShift.description || ''
      })
      setSelectedUserIds([])
      setIndividualTitles({})
      setUseTemplate(jobTemplates.includes(editShift.title))
    } else if (initialDate) {
      // 新規作成モード（クリックした日付をセット）
      setMode('multiple') // デフォルトで複数選択モード
      const start = new Date(initialDate)
      start.setHours(9, 0, 0, 0) // デフォルト9時
      const end = new Date(start)
      end.setHours(12, 0, 0, 0) // デフォルト12時
      
      const offset = start.getTimezoneOffset() * 60000
      const localStart = new Date(start.getTime() - offset).toISOString().slice(0, 16)
      const localEnd = new Date(end.getTime() - offset).toISOString().slice(0, 16)

      setFormData({ user_id: '', title: '受付', start: localStart, end: localEnd, supervisor_id: '', description: '' })
      setSelectedUserIds([])
      setIndividualTitles({})
      setUseTemplate(true)
    }
  }, [editShift, initialDate, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editShift) {
        // 編集モード: 単一シフト更新
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
        // supervisor_idが空文字列でない場合のみ追加、それ以外はnullを明示的に設定しない（カラムが存在しない場合のエラーを避ける）
        if (formData.supervisor_id && formData.supervisor_id.trim() !== '') {
          payload.supervisor_id = formData.supervisor_id
        }

        const { error } = await supabase.from('shifts').update(payload).eq('id', editShift.id)
        if (error) {
          console.error('シフト更新エラー:', error)
          throw error
        }
        if (error) throw error
      } else if (mode === 'single') {
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

        const { error } = await supabase.from('shifts').insert([payload])
        if (error) {
          console.error('シフト挿入エラー:', error)
          throw error
        }
        if (error) throw error
      } else {
        // 複数ユーザーモード: 一括作成
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

        const { error } = await supabase.from('shifts').insert(payloads)
        if (error) {
          console.error('シフト一括挿入エラー:', error)
          throw error
        }
        if (error) throw error
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
    const { error } = await supabase.from('shifts').delete().eq('id', editShift.id)
    if (!error) {
      onSaved()
      onClose()
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
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-3">作成モード</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('single')
                    setSelectedUserIds([])
                    setFormData({...formData, user_id: ''})
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    mode === 'single'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <UserCheck size={18} />
                  1人ずつ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('multiple')
                    setFormData({...formData, user_id: ''})
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    mode === 'multiple'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Users size={18} />
                  複数人一括
                </button>
              </div>
            </div>
          )}

          {/* ユーザー選択 */}
          {mode === 'single' || editShift ? (
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
          {mode === 'multiple' && !editShift && (
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
          {titleMode === 'same' || mode === 'single' || editShift ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                役割・内容{mode === 'multiple' && '（全員共通）'}
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
                    required={mode === 'single' || !!editShift || titleMode === 'same'}
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
                    required={mode === 'single' || !!editShift || titleMode === 'same'}
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

          {/* 統括者選択 */}
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
                  {mode === 'multiple' ? '作成中...' : '保存中...'}
                </>
              ) : (
                <>
                  {mode === 'multiple' && selectedUserIds.length > 0 && (
                    <Copy size={16} />
                  )}
                  {mode === 'multiple' && selectedUserIds.length > 0
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
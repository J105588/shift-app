'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile, Shift } from '@/lib/types'
import { X } from 'lucide-react'

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
  const [formData, setFormData] = useState({
    user_id: '',
    title: '',
    start: '',
    end: ''
  })

  // 初期化とユーザー一覧取得
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('*')
      if (data) setUsers(data as Profile[])
    }
    if (isOpen) fetchUsers()
  }, [isOpen])

  // フォーム初期値設定
  useEffect(() => {
    if (editShift) {
      // 編集モード
      setFormData({
        user_id: editShift.user_id,
        title: editShift.title,
        start: new Date(editShift.start_time).toISOString().slice(0, 16),
        end: new Date(editShift.end_time).toISOString().slice(0, 16)
      })
    } else if (initialDate) {
      // 新規作成モード（クリックした日付をセット）
      // ※UTCとJSTのズレ簡易補正（簡易版）
      const start = new Date(initialDate)
      start.setHours(9, 0, 0, 0) // デフォルト9時
      const end = new Date(start)
      end.setHours(12, 0, 0, 0) // デフォルト12時
      
      // toISOString().slice(0, 16) は "YYYY-MM-DDTHH:mm" 形式にするハック
      // 注: 本番運用では date-fns-tz などで厳密なタイムゾーン管理推奨
      const offset = start.getTimezoneOffset() * 60000
      const localStart = new Date(start.getTime() - offset).toISOString().slice(0, 16)
      const localEnd = new Date(end.getTime() - offset).toISOString().slice(0, 16)

      setFormData({ user_id: '', title: '受付', start: localStart, end: localEnd })
    }
  }, [editShift, initialDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.user_id) return alert('担当者を選択してください')

    const payload = {
      user_id: formData.user_id,
      title: formData.title,
      start_time: new Date(formData.start).toISOString(),
      end_time: new Date(formData.end).toISOString(),
    }

    let error
    if (editShift) {
      const { error: e } = await supabase.from('shifts').update(payload).eq('id', editShift.id)
      error = e
    } else {
      const { error: e } = await supabase.from('shifts').insert([payload])
      error = e
    }

    if (error) alert('エラー: ' + error.message)
    else {
      onSaved()
      onClose()
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg w-full max-w-md shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-600 p-5 flex justify-between items-center">
          <h2 className="font-bold text-xl text-white">{editShift ? 'シフト編集' : 'シフト追加'}</h2>
          <button 
            onClick={onClose}
            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-white">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">担当者</label>
            <select 
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white"
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

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">役割・内容</label>
            <input 
              type="text" 
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white"
              placeholder="例: 受付、案内、販売など"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">開始</label>
              <input 
                type="datetime-local" 
                className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white"
                value={formData.start}
                onChange={(e) => setFormData({...formData, start: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">終了</label>
              <input 
                type="datetime-local" 
                className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white"
                value={formData.end}
                onChange={(e) => setFormData({...formData, end: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit" 
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              保存
            </button>
            {editShift && (
              <button 
                type="button" 
                onClick={handleDelete} 
                className="px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-semibold transition-colors duration-200 border-2 border-red-200 hover:border-red-300"
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
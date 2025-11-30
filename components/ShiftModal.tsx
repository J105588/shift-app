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
      className="fixed inset-0 bg-rose-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white/90 rounded-2xl w-full max-w-md shadow-lg overflow-hidden border border-pink-100/50 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-rose-200/60 to-pink-200/60 p-5 flex justify-between items-center border-b border-pink-200/50">
          <h2 className="font-semibold text-xl text-rose-700">{editShift ? 'シフト編集' : 'シフト追加'}</h2>
          <button 
            onClick={onClose}
            className="text-rose-600/70 hover:text-rose-700 hover:bg-white/50 p-2 rounded-lg transition-colors duration-200"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-rose-700/80 mb-2">担当者</label>
            <select 
              className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
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
            <label className="block text-sm font-semibold text-rose-700/80 mb-2">役割・内容</label>
            <input 
              type="text" 
              className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
              placeholder="例: 受付、案内、販売など"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-rose-700/80 mb-2">開始</label>
              <input 
                type="datetime-local" 
                className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
                value={formData.start}
                onChange={(e) => setFormData({...formData, start: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-rose-700/80 mb-2">終了</label>
              <input 
                type="datetime-local" 
                className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
                value={formData.end}
                onChange={(e) => setFormData({...formData, end: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit" 
              className="flex-1 bg-gradient-to-r from-rose-300/80 to-pink-300/80 text-rose-700 py-3 rounded-xl font-semibold hover:from-rose-300 hover:to-pink-300 transition-all duration-200 shadow-sm hover:shadow-md border border-pink-200/50"
            >
              保存
            </button>
            {editShift && (
              <button 
                type="button" 
                onClick={handleDelete} 
                className="px-6 py-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 font-semibold transition-colors duration-200 border border-rose-200 hover:border-rose-300"
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
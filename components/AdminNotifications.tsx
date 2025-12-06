'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/lib/types'
import { Bell, Send } from 'lucide-react'

export default function AdminNotifications() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').order('display_name')
      if (data) setUsers(data as Profile[])
    }
    load()
  }, [supabase])

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(users.map((u) => u.id))
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
    if (selectedUserIds.length === 0) {
      alert('少なくとも1人の宛先を選択してください')
      return
    }

    setIsSending(true)
    try {
      // 即時送信用ジョブを作成（scheduled_at は現在時刻）
      const nowIso = new Date().toISOString()
      const payloads = selectedUserIds.map((userId) => ({
        target_user_id: userId,
        title: title.trim(), // 前後の空白を削除
        body: body.trim(), // 前後の空白を削除
        scheduled_at: nowIso,
      }))

      const { error } = await supabase.from('notifications').insert(payloads)
      if (error) throw error

      alert('通知ジョブを作成しました（ログイン中の端末に順次配信されます）。')
      setTitle('')
      setBody('')
      setSelectedUserIds([]) // 選択をリセット
    } catch (err: any) {
      console.error('通知作成エラー:', err)
      alert('通知の作成に失敗しました: ' + (err.message || '詳細不明'))
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
          <p className="text-xs sm:text-sm text-slate-600">
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

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-slate-700">
              宛先ユーザー
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
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
            <p className="text-xs text-slate-600 mt-1">
              {selectedUserIds.length}人を選択中
            </p>
          )}
        </div>

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



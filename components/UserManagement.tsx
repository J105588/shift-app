'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/lib/types'
import { UserPlus, Trash2 } from 'lucide-react'

export default function UserManagement() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  
  // フォーム用
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('staff')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, role }),
      })

      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)

      alert('ユーザーを作成しました！')
      setEmail(''); setPassword(''); setDisplayName('');
      fetchUsers() // リスト更新
    } catch (err: any) {
      alert('エラー: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 overflow-y-auto h-full pb-20">
      {/* 登録フォーム */}
      <div className="bg-white/70 backdrop-blur-sm p-6 sm:p-8 rounded-2xl shadow-md border border-pink-100/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-rose-200/60 to-pink-200/60 rounded-xl border border-pink-200/50">
            <UserPlus className="text-rose-600" size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-xl text-rose-700">新規スタッフ登録</h3>
            <p className="text-sm text-rose-500/70">新しいスタッフのアカウントを作成します</p>
          </div>
        </div>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-rose-700/80 mb-2">表示名</label>
            <input 
              type="text" 
              placeholder="例: 佐藤" 
              required
              className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-rose-700/80 mb-2">権限</label>
            <select 
              className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
              value={role} 
              onChange={e => setRole(e.target.value)}
            >
              <option value="staff">一般スタッフ</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-rose-700/80 mb-2">ログインID（メール）</label>
            <input 
              type="email" 
              placeholder="staff@festival.com" 
              required
              className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
              value={email} 
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-rose-700/80 mb-2">初期パスワード</label>
            <input 
              type="text" 
              placeholder="初期パスワードを設定" 
              required
              className="w-full border border-pink-200 p-3 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
              value={password} 
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            disabled={isSubmitting}
            className="md:col-span-2 bg-gradient-to-r from-rose-300/80 to-pink-300/80 text-rose-700 py-3 rounded-xl font-semibold hover:from-rose-300 hover:to-pink-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md mt-2 border border-pink-200/50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                作成中...
              </span>
            ) : (
              'アカウントを作成'
            )}
          </button>
        </form>
      </div>

      {/* ユーザーリスト */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-md border border-pink-100/50 overflow-hidden">
        <div className="p-6 border-b border-pink-100/50 bg-gradient-to-r from-rose-50/50 to-pink-50/50">
          <h3 className="font-semibold text-lg text-rose-700">登録スタッフ一覧</h3>
          <p className="text-sm text-rose-500/70 mt-1">{users.length}人のスタッフが登録されています</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-rose-50/50 border-b border-pink-100/50">
              <tr>
                <th className="p-4 text-sm font-semibold text-rose-600">名前</th>
                <th className="p-4 text-sm font-semibold text-rose-600">権限</th>
                <th className="p-4 text-sm font-semibold text-rose-600">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50/50">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-rose-400/60">
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></span>
                      読み込み中...
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-rose-400/60">
                    スタッフが登録されていません
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-rose-50/30 transition-colors duration-150">
                    <td className="p-4 font-semibold text-rose-700">{user.display_name}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin' 
                          ? 'bg-gradient-to-r from-rose-100/60 to-pink-100/60 text-rose-700 border border-rose-200/50' 
                          : 'bg-pink-50/60 text-rose-600/80 border border-pink-200/50'
                      }`}>
                        {user.role === 'admin' ? '👑 管理者' : '👤 スタッフ'}
                      </span>
                    </td>
                    <td className="p-4 text-rose-500/70 text-sm">
                      {/* @ts-ignore */}
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
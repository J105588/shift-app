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

      let data
      try {
        data = await res.json()
      } catch (parseError) {
        // JSON解析に失敗した場合
        const text = await res.text()
        throw new Error(`サーバーエラー (${res.status}): ${text || 'レスポンスの解析に失敗しました'}`)
      }
      
      // 成功時（200-299）またはデータが書き込まれている場合
      if (res.ok || data.success) {
        alert(data.message || 'ユーザーを作成しました！')
        setEmail(''); setPassword(''); setDisplayName('');
        fetchUsers() // リスト更新
      } else {
        // エラー時
        throw new Error(data.error || `ユーザー作成に失敗しました (${res.status})`)
      }
    } catch (err: any) {
      console.error('Create user error:', err)
      alert('エラー: ' + (err.message || 'ユーザー作成中にエラーが発生しました'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-20">
      {/* 登録フォーム */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <UserPlus className="text-blue-600" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg sm:text-xl text-slate-900">新規ユーザー登録</h3>
            <p className="text-xs sm:text-sm text-slate-600">新しいユーザーのアカウントを作成します</p>
          </div>
        </div>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">表示名</label>
            <input 
              type="text" 
              placeholder="例: 佐藤" 
              required
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base touch-manipulation"
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">権限</label>
            <select 
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base touch-manipulation"
              value={role} 
              onChange={e => setRole(e.target.value)}
            >
              <option value="staff">一般ユーザー</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">ログインID（メール）</label>
            <input 
              type="email" 
              placeholder="staff@festival.com" 
              required
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
              value={email} 
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">初期パスワード</label>
            <input 
              type="text" 
              placeholder="初期パスワードを設定" 
              required
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
              value={password} 
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button 
            disabled={isSubmitting}
            className="md:col-span-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg mt-2 touch-manipulation min-h-[48px]"
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
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-base sm:text-lg text-slate-900">登録ユーザー一覧</h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">{users.length}人のユーザーが登録されています</p>
        </div>
        
        {/* デスクトップ: テーブル表示 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-700">名前</th>
                <th className="p-4 text-sm font-semibold text-slate-700">権限</th>
                <th className="p-4 text-sm font-semibold text-slate-700">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                      読み込み中...
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500">
                    ユーザーが登録されていません
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="p-4 font-semibold text-slate-900">{user.display_name}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {/* @ts-ignore */}
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* モバイル: カード表示 */}
        <div className="md:hidden divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                読み込み中...
              </span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              ユーザーが登録されていません
            </div>
          ) : (
            users.map(user => (
              <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors duration-150">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-base mb-2">
                      {user.display_name}
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      {/* @ts-ignore */}
                      登録日: {user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-'}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                    user.role === 'admin' 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
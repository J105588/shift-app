'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/lib/types'
import { UserPlus, Edit2, X, LogOut } from 'lucide-react'

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

  // 編集モーダル用
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'staff'>('staff')
  const [isEditing, setIsEditing] = useState(false)

  // 強制ログアウトモーダル用
  const [logoutTargetUser, setLogoutTargetUser] = useState<Profile | null>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/get-users')
      const data = await res.json()
      if (data.success && data.users) {
        setUsers(data.users as Profile[])
      } else {
        // フォールバック: 直接profilesテーブルから取得
        const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (profilesData) setUsers(profilesData as Profile[])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      // フォールバック: 直接profilesテーブルから取得
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (data) setUsers(data as Profile[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // 定期的に最新データを取得（30秒ごと）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers()
    }, 30000) // 30秒ごと

    return () => {
      clearInterval(interval)
    }
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

  const handleEditUser = (user: Profile) => {
    setEditingUser(user)
    setEditEmail(user.email || '')
    setEditDisplayName(user.display_name || '')
    setEditRole(user.role)
    setIsEditing(true)
  }

  const handleCloseEditModal = () => {
    setEditingUser(null)
    setEditEmail('')
    setEditDisplayName('')
    setEditRole('staff')
    setIsEditing(false)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          email: editEmail,
          displayName: editDisplayName,
          role: editRole
        }),
      })

      let data
      try {
        data = await res.json()
      } catch (parseError) {
        const text = await res.text()
        throw new Error(`サーバーエラー (${res.status}): ${text || 'レスポンスの解析に失敗しました'}`)
      }
      
      if (res.ok && data.success) {
        alert(data.message || 'ユーザー情報を更新しました！')
        handleCloseEditModal()
        fetchUsers() // リスト更新
      } else {
        throw new Error(data.error || `ユーザー更新に失敗しました (${res.status})`)
      }
    } catch (err: any) {
      console.error('Update user error:', err)
      alert('エラー: ' + (err.message || 'ユーザー更新中にエラーが発生しました'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForceLogout = (user: Profile) => {
    setLogoutTargetUser(user)
    setShowLogoutModal(true)
    setAdminPassword('')
  }

  const handleCloseLogoutModal = () => {
    setLogoutTargetUser(null)
    setShowLogoutModal(false)
    setNewPassword('')
    setAdminPassword('')
  }

  const handleConfirmForceLogout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!logoutTargetUser) return

    if (!newPassword || newPassword.trim() === '') {
      alert('新しいパスワードを入力してください')
      return
    }

    if (newPassword.length < 6) {
      alert('パスワードは6文字以上である必要があります')
      return
    }

    if (!adminPassword) {
      alert('認証パスワードを入力してください')
      return
    }

    setIsLoggingOut(true)

    try {
      const res = await fetch('/api/admin/force-logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: logoutTargetUser.id,
          newPassword: newPassword,
          adminPassword: adminPassword
        }),
      })

      let data
      try {
        data = await res.json()
      } catch (parseError) {
        const text = await res.text()
        throw new Error(`サーバーエラー (${res.status}): ${text || 'レスポンスの解析に失敗しました'}`)
      }
      
      if (res.ok && data.success) {
        alert(data.message || 'ユーザーを強制的にログアウトしました')
        handleCloseLogoutModal()
        fetchUsers() // ユーザー一覧を更新
      } else {
        throw new Error(data.error || `強制ログアウトに失敗しました (${res.status})`)
      }
    } catch (err: any) {
      console.error('Force logout error:', err)
      alert('エラー: ' + (err.message || '強制ログアウト中にエラーが発生しました'))
    } finally {
      setIsLoggingOut(false)
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
                <th className="p-4 text-sm font-semibold text-slate-700">メールアドレス</th>
                <th className="p-4 text-sm font-semibold text-slate-700">権限</th>
                <th className="p-4 text-sm font-semibold text-slate-700">登録日</th>
                <th className="p-4 text-sm font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                      読み込み中...
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    ユーザーが登録されていません
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="p-4 font-semibold text-slate-900">{user.display_name || '-'}</td>
                    <td className="p-4 text-slate-600 text-sm">{user.email || '-'}</td>
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
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                        >
                          <Edit2 size={16} />
                          編集
                        </button>
                        <button
                          onClick={() => handleForceLogout(user)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                        >
                          <LogOut size={16} />
                          強制ログアウト
                        </button>
                      </div>
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
                    <div className="font-semibold text-slate-900 text-base mb-1">
                      {user.display_name || '-'}
                    </div>
                    <div className="text-xs text-slate-600 mb-1">
                      {user.email || '-'}
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      {/* @ts-ignore */}
                      登録日: {user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                      user.role === 'admin' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                    </span>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors duration-150"
                      >
                        <Edit2 size={14} />
                        編集
                      </button>
                      <button
                        onClick={() => handleForceLogout(user)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                      >
                        <LogOut size={14} />
                        強制ログアウト
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 編集モーダル */}
      {isEditing && editingUser && (
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
          onClick={handleCloseEditModal}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">ユーザー情報を編集</h3>
                <button
                  onClick={handleCloseEditModal}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-all duration-200"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">表示名</label>
                  <input 
                    type="text" 
                    placeholder="例: 佐藤" 
                    required
                    className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
                    value={editDisplayName} 
                    onChange={e => setEditDisplayName(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">メールアドレス</label>
                  <input 
                    type="email" 
                    placeholder="staff@festival.com" 
                    required
                    className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
                    value={editEmail} 
                    onChange={e => setEditEmail(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">権限</label>
                  <select 
                    className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
                    value={editRole} 
                    onChange={e => setEditRole(e.target.value as 'admin' | 'staff')}
                  >
                    <option value="staff">一般ユーザー</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-all duration-200"
                  >
                    キャンセル
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        更新中...
                      </span>
                    ) : (
                      '更新する'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 強制ログアウト確認モーダル */}
      {showLogoutModal && logoutTargetUser && (
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
          onClick={handleCloseLogoutModal}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-md w-full zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <LogOut className="text-red-600" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">強制ログアウト</h3>
                </div>
                <button
                  onClick={handleCloseLogoutModal}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-all duration-200"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-slate-700 mb-4">
                  <span className="font-semibold">{logoutTargetUser.display_name || logoutTargetUser.email}</span> を強制的にログアウトさせますか？
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-red-700 font-semibold mb-1">注意事項</p>
                  <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                    <li>対象ユーザーはすべてのデバイスからログアウトされます</li>
                    <li>対象ユーザーのパスワードが指定したパスワードに変更されます</li>
                    <li>この操作を実行するには、認証パスワードが必要です</li>
                  </ul>
                </div>
              </div>
              
              <form onSubmit={handleConfirmForceLogout} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    新しいパスワード <span className="text-red-600">*</span>
                  </label>
                  <input 
                    type="password" 
                    placeholder="対象ユーザーの新しいパスワードを入力（6文字以上）" 
                    required
                    minLength={6}
                    className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all duration-200 bg-white text-base"
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1">対象ユーザーはこのパスワードで次回ログインします</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    認証パスワード <span className="text-red-600">*</span>
                  </label>
                  <input 
                    type="password" 
                    placeholder="認証パスワードを入力" 
                    required
                    className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all duration-200 bg-white text-base"
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">この操作を実行するための認証パスワード</p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseLogoutModal}
                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 active:bg-slate-300 transition-all duration-200"
                  >
                    キャンセル
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoggingOut}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    {isLoggingOut ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        実行中...
                      </span>
                    ) : (
                      '強制ログアウト'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
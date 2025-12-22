'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/lib/types'
import { UserPlus, Edit2, X, LogOut, Copy, Check, Upload, Filter, Download, Settings, Trash2, RefreshCw } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export default function UserManagement() {
  const supabase = createClient()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // フォーム用
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('staff')
  const [groupName, setGroupName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 編集モーダル用
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'staff'>('staff')
  const [editGroupName, setEditGroupName] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // 強制ログアウトモーダル用
  const [logoutTargetUser, setLogoutTargetUser] = useState<Profile | null>(null)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // パスワード表示モーダル用
  // パスワード表示モーダル用
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [displayedPassword, setDisplayedPassword] = useState('')
  const [passwordTargetUser, setPasswordTargetUser] = useState<Profile | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)
  // フィルタリング用
  const [filterGroup, setFilterGroup] = useState<string>('all')

  // 一括登録モーダル用
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedUsers, setParsedUsers] = useState<{ email: string; password: string; displayName: string; role: string; groupName: string }[]>([])
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'parsing' | 'uploading' | 'complete' | 'error'>('idle')
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

  // グループ操作用
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
  const [newGroupNameInput, setNewGroupNameInput] = useState('')
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false)
  const [isLogoutGroupModalOpen, setIsLogoutGroupModalOpen] = useState(false)

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
        body: JSON.stringify({ email, password, displayName, role, groupName }),
      })

      let data
      try {
        data = await res.json()
      } catch (_) {
        // JSON解析に失敗した場合
        const text = await res.text()
        throw new Error(`サーバーエラー (${res.status}): ${text || 'レスポンスの解析に失敗しました'}`)
      }

      // 成功時（200-299）またはデータが書き込まれている場合
      if (res.ok || data.success) {
        alert(data.message || 'ユーザーを作成しました！')
        setEmail(''); setPassword(''); setDisplayName(''); setGroupName('');
        fetchUsers() // リスト更新
      } else {
        // エラー時
        throw new Error(data.error || `ユーザー作成に失敗しました (${res.status})`)
      }
    } catch (err) {
      console.error('Create user error:', err)
      alert('エラー: ' + ((err as Error).message || 'ユーザー作成中にエラーが発生しました'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditUser = (user: Profile) => {
    setEditingUser(user)
    setEditEmail(user.email || '')
    setEditDisplayName(user.display_name || '')
    setEditRole(user.role)
    setEditGroupName(user.group_name || '')
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
          role: editRole,
          groupName: editGroupName
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
    } catch (err) {
      console.error('Update user error:', err)
      alert('エラー: ' + ((err as Error).message || 'ユーザー更新中にエラーが発生しました'))
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

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false)
    setDisplayedPassword('')
    setPasswordTargetUser(null)
    setPasswordCopied(false)
  }

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(displayedPassword)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy password:', err)
      alert('パスワードのコピーに失敗しました')
    }
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
      } catch (_) {
        const text = await res.text()
        throw new Error(`サーバーエラー (${res.status}): ${text || 'レスポンスの解析に失敗しました'}`)
      }

      if (res.ok && data.success) {
        // パスワードを表示するモーダルを開く
        setPasswordTargetUser(logoutTargetUser)
        setDisplayedPassword(newPassword)
        setShowPasswordModal(true)
        handleCloseLogoutModal()
        fetchUsers() // ユーザー一覧を更新
      } else {
        throw new Error(data.error || `強制ログアウトに失敗しました (${res.status})`)
      }
    } catch (err) {
      console.error('Force logout error:', err)
      alert('エラー: ' + ((err as Error).message || '強制ログアウト中にエラーが発生しました'))
    } finally {
      setIsLoggingOut(false)
    }
  }

  // グループ一覧を抽出
  const uniqueGroups = Array.from(new Set(users.map(u => u.group_name).filter(Boolean))) as string[]

  // フィルタリングされたユーザー
  const filteredUsers = users.filter(user => {
    if (filterGroup === 'all') return true
    if (filterGroup === 'no_group') return !user.group_name
    return user.group_name === filterGroup
  })

  // CSV解析機能
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    setBulkStatus('parsing')

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split(/\r\n|\n/).filter(line => line.trim())

        // ヘッダーチェック（簡易的）
        // 想定フォーマット: email,password,display_name,role,group_name

        const parsed: { email: string; password: string; displayName: string; role: string; groupName: string }[] = []
        // 1行目はヘッダーとしてスキップ、あるいは中身を見る
        // ここでは単純に2行目以降をデータとして扱う

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim())
          if (cols.length < 3) continue // 最低限 email, pass, name は必要

          // カンマ区切りの簡易パース。引用符などは考慮しない簡易実装。
          parsed.push({
            email: cols[0],
            password: cols[1],
            displayName: cols[2],
            role: cols[3] || 'staff',
            groupName: cols[4] || ''
          })
        }

        setParsedUsers(parsed)
        setBulkStatus('idle')
      } catch (err) {
        console.error('CSV Parse Error:', err)
        alert('CSVの解析に失敗しました')
        setBulkStatus('error')
      }
    }
    reader.readAsText(file)
  }

  const handleBulkUpload = async () => {
    if (parsedUsers.length === 0) return
    setIsSubmitting(true)
    setBulkStatus('uploading')

    try {
      const res = await fetch('/api/admin/bulk-create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: parsedUsers }),
      })

      const data = await res.json()

      if (res.ok) {
        setBulkResult(data.results)
        setBulkStatus('complete')
        fetchUsers()
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      alert('一括登録エラー: ' + (err as Error).message)
      setBulkStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // グループ操作ハンドラー
  const handleRenameGroup = async () => {
    if (!newGroupNameInput.trim()) return
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/group/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldGroupName: filterGroup, newGroupName: newGroupNameInput }),
      })

      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        setIsRenameModalOpen(false)
        setFilterGroup(newGroupNameInput) // フィルターを新しい名前に更新
        fetchUsers()
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      alert('エラー: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGroupUsers = async () => {
    if (!filterGroup || filterGroup === 'all' || filterGroup === 'no_group') return
    // モーダルで確認済みなのでconfirmは不要

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/group/delete-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName: filterGroup }),
      })

      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        setIsDeleteGroupModalOpen(false)
        setFilterGroup('all')
        fetchUsers()
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      alert('エラー: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogoutGroupUsers = async () => {
    if (!filterGroup || filterGroup === 'all' || filterGroup === 'no_group') return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/group/logout-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName: filterGroup }),
      })

      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        setIsLogoutGroupModalOpen(false)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      alert('エラー: ' + (err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-20">
      {/* 登録フォーム */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-lg shadow-sm border border-slate-200">

        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg sm:text-xl text-slate-900">新規ユーザー登録</h3>
              <p className="text-xs sm:text-sm text-slate-600">新しいユーザーのアカウントを作成します</p>
            </div>
          </div>
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">CSV一括登録</span>
          </button>
        </div>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <label className="block text-sm font-semibold text-slate-700 mb-2">グループ（任意）</label>
            <input
              type="text"
              placeholder="例: 受付班"
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              メールアドレス <span className="text-slate-400 text-xs font-normal ml-1">（省略可）</span>
            </label>
            <input
              type="email"
              placeholder="email@example.com"
              className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            className="md:col-span-2 lg:col-span-3 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg mt-2 touch-manipulation min-h-[48px]"
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
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900">登録ユーザー一覧</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">{filteredUsers.length}人のユーザーが表示されています</p>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-500" />
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="all">すべてのグループ</option>
                <option value="no_group">グループなし</option>
                {uniqueGroups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* グループ操作アクションバー */}
          {filterGroup !== 'all' && filterGroup !== 'no_group' && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
              <span className="text-xs font-semibold text-slate-500 mr-2">グループ操作:</span>
              <button
                onClick={() => {
                  setNewGroupNameInput(filterGroup)
                  setIsRenameModalOpen(true)
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={14} />
                名前変更
              </button>
              <button
                onClick={() => setIsLogoutGroupModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 transition-colors"
                title="このグループの全員を強制ログアウト"
              >
                <LogOut size={14} />
                一括ログアウト
              </button>
              <button
                onClick={() => setIsDeleteGroupModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-md text-xs font-medium hover:bg-red-50 transition-colors"
                title="このグループの全員を削除"
              >
                <Trash2 size={14} />
                一括削除
              </button>
            </div>
          )}
        </div>

        {/* デスクトップ: テーブル表示 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-slate-700">名前</th>
                <th className="p-4 text-sm font-semibold text-slate-700">メールアドレス</th>
                <th className="p-4 text-sm font-semibold text-slate-700">グループ</th>
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    該当するユーザーがいません
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="p-4 font-semibold text-slate-900">{user.display_name || '-'}</td>
                    <td className="p-4 text-slate-600 text-sm">{user.email || '-'}</td>
                    <td className="p-4">
                      {user.group_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {user.group_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'admin'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                        {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
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
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              該当するユーザーがいません
            </div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors duration-150">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-base mb-1 flex items-center gap-2">
                      {user.display_name || '-'}
                      {user.group_name && (
                        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {user.group_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mb-1">
                      {user.email || '-'}
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      登録日: {user.created_at ? new Date(user.created_at).toLocaleDateString('ja-JP') : '-'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${user.role === 'admin'
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
                        <Edit2 size={16} />
                        編集
                      </button>
                      <button
                        onClick={() => handleForceLogout(user)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-150"
                      >
                        <LogOut size={16} />
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
      {
        isEditing && editingUser && (
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
                    <label className="block text-sm font-semibold text-slate-700 mb-2">グループ（任意）</label>
                    <input
                      type="text"
                      placeholder="例: 受付班"
                      className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-base"
                      value={editGroupName}
                      onChange={e => setEditGroupName(e.target.value)}
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
        )
      }

      {/* 強制ログアウト確認モーダル */}
      {
        showLogoutModal && logoutTargetUser && (
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
                    <span className="font-semibold">{logoutTargetUser?.display_name || logoutTargetUser?.email}</span> を強制的にログアウトさせますか？
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
        )
      }

      {/* パスワード表示モーダル */}
      {
        showPasswordModal && passwordTargetUser && (
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
            onClick={handleClosePasswordModal}
          >
            <div
              className="bg-white rounded-lg shadow-2xl max-w-md w-full zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Check className="text-green-600" size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">パスワード設定完了</h3>
                  </div>
                  <button
                    onClick={handleClosePasswordModal}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1 transition-all duration-200"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-slate-700 mb-4">
                    <span className="font-semibold">{passwordTargetUser?.display_name || passwordTargetUser?.email}</span> のパスワードが変更されました。
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-xs text-blue-700 font-semibold mb-2">新しいパスワード</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white border-2 border-blue-200 rounded-lg p-3 text-base font-mono text-slate-900 break-all">
                        {displayedPassword}
                      </code>
                      <button
                        onClick={handleCopyPassword}
                        className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 flex items-center justify-center min-w-[48px]"
                        title="パスワードをコピー"
                      >
                        {passwordCopied ? (
                          <Check size={20} />
                        ) : (
                          <Copy size={20} />
                        )}
                      </button>
                    </div>
                    {passwordCopied && (
                      <p className="text-xs text-green-600 mt-2 font-semibold">コピーしました！</p>
                    )}
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-700 font-semibold mb-1">重要</p>
                    <ul className="text-xs text-yellow-600 space-y-1 list-disc list-inside">
                      <li>このパスワードは今だけ表示されます</li>
                      <li>対象ユーザーに安全に共有してください</li>
                      <li>対象ユーザーはこのパスワードで次回ログインできます</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleClosePasswordModal}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-all duration-200"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* 一括登録モーダル */}
      {
        isBulkModalOpen && (
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
            onClick={() => setIsBulkModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto zoom-in-95 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">CSV一括登録</h3>
                <button
                  onClick={() => setIsBulkModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {!bulkStatus || bulkStatus === 'idle' || bulkStatus === 'parsing' || bulkStatus === 'error' ? (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 font-semibold mb-2">CSVフォーマットについて</p>
                      <p className="text-xs text-blue-700 mb-2">以下のヘッダーを持つCSVファイルをアップロードしてください（1行目はヘッダーとして無視されます）。</p>
                      <code className="block bg-white p-2 rounded border border-blue-200 text-xs font-mono text-slate-700 mb-2">
                        email,password,display_name,role,group_name
                      </code>
                      <p className="text-xs text-blue-700">例: user1@example.com,pass123,受付太郎,staff,受付班</p>
                    </div>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                      <input
                        type="file"
                        id="csv-upload"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                        <Upload className="text-slate-400 mb-4" size={48} />
                        <span className="text-slate-900 font-semibold text-lg mb-1">CSVファイルを選択</span>
                        <span className="text-slate-500 text-sm">クリックしてアップロード</span>
                      </label>
                    </div>

                    {parsedUsers.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-bold text-slate-900 mb-3">プレビュー ({parsedUsers.length}件)</h4>
                        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="p-2 border-b">名前</th>
                                <th className="p-2 border-b">Email</th>
                                <th className="p-2 border-b">グループ</th>
                                <th className="p-2 border-b">権限</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {parsedUsers.slice(0, 50).map((u, i) => (
                                <tr key={i}>
                                  <td className="p-2 text-slate-700">{u.displayName}</td>
                                  <td className="p-2 text-slate-500">{u.email}</td>
                                  <td className="p-2 text-slate-500">{u.groupName || '-'}</td>
                                  <td className="p-2 text-slate-500">{u.role}</td>
                                </tr>
                              ))}
                              {parsedUsers.length > 50 && (
                                <tr>
                                  <td colSpan={4} className="p-2 text-center text-slate-400">他 {parsedUsers.length - 50} 件...</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : bulkStatus === 'uploading' ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h3 className="text-lg font-bold text-slate-900">登録処理中...</h3>
                    <p className="text-slate-500">画面を閉じないでください</p>
                  </div>
                ) : bulkStatus === 'complete' && bulkResult ? (
                  <div className="py-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <Check size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">完了しました</h3>
                      <p className="text-slate-600">
                        成功: <span className="font-bold text-green-600">{bulkResult.success}</span>件 /
                        失敗: <span className="font-bold text-red-600">{bulkResult.failed}</span>件
                      </p>
                    </div>

                    {bulkResult.errors.length > 0 && (
                      <div className="text-left bg-red-50 p-4 rounded-lg border border-red-100 max-h-40 overflow-y-auto">
                        <p className="text-xs font-bold text-red-800 mb-2">エラー詳細:</p>
                        <ul className="text-xs text-red-700 list-disc list-inside space-y-1">
                          {bulkResult.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setIsBulkModalOpen(false)
                        setBulkStatus('idle')
                        setParsedUsers([])
                        setBulkResult(null)
                      }}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      閉じる
                    </button>
                  </div>
                ) : null}
              </div>

              {(bulkStatus === 'idle' || bulkStatus === 'parsing') && (
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                  <button
                    onClick={() => setIsBulkModalOpen(false)}
                    className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={parsedUsers.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {parsedUsers.length}件を登録
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }
      {/* グループ名変更モーダル */}
      {
        isRenameModalOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in" onClick={() => setIsRenameModalOpen(false)}>
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">グループ名の変更</h3>
                <input
                  type="text"
                  value={newGroupNameInput}
                  onChange={e => setNewGroupNameInput(e.target.value)}
                  className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 outline-none mb-4"
                  placeholder="新しいグループ名"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsRenameModalOpen(false)}
                    className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleRenameGroup}
                    disabled={isSubmitting || !newGroupNameInput.trim()}
                    className="flex-1 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    変更
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* グループ削除確認モーダル */}
      {
        isDeleteGroupModalOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in" onClick={() => setIsDeleteGroupModalOpen(false)}>
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-full text-red-600"><Trash2 size={24} /></div>
                  <h3 className="text-lg font-bold text-slate-900">グループ一括削除</h3>
                </div>
                <p className="text-slate-600 mb-4">
                  グループ「<span className="font-bold">{filterGroup}</span>」に所属するすべてのユーザーを削除しますか？<br />
                  <span className="text-red-600 text-sm font-bold mt-2 block">⚠️ この操作は取り消せません。</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsDeleteGroupModalOpen(false)}
                    className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleDeleteGroupUsers}
                    disabled={isSubmitting}
                    className="flex-1 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    削除実行
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* グループ一括ログアウト確認モーダル */}
      {
        isLogoutGroupModalOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in" onClick={() => setIsLogoutGroupModalOpen(false)}>
            <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-100 rounded-full text-yellow-600"><LogOut size={24} /></div>
                  <h3 className="text-lg font-bold text-slate-900">一括ログアウト</h3>
                </div>
                <p className="text-slate-600 mb-4">
                  グループ「<span className="font-bold">{filterGroup}</span>」の全ユーザーを強制的にログアウトさせますか？
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsLogoutGroupModalOpen(false)}
                    className="flex-1 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleLogoutGroupUsers}
                    disabled={isSubmitting}
                    className="flex-1 py-2 text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    実行
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

    </div >
  )
}
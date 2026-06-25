'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, ArrowRight, CalendarDays, AlertTriangle } from 'lucide-react'
import { setupPushNotificationsForUser } from '@/components/PushNotificationManager'
import { customAlert } from '@/lib/alert'

// 動的レンダリングを強制（認証が必要なため）
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)


  // ローカルストレージのログイン記録をチェック
  useEffect(() => {
    const checkStoredAuth = async () => {
      if (typeof window === 'undefined') {
        setShowLoginModal(true)
        setIsVerifying(false)
        return
      }

      // 検証中状態を維持
      setIsVerifying(true)
      setShowLoginModal(false)

      const storedAuth = localStorage.getItem('shift-app-auth')

      if (!storedAuth) {
        // ログイン記録が見つからない場合はログインモーダルを表示
        setShowLoginModal(true)
        setIsVerifying(false)
        return
      }

      // ログイン記録が見つかった場合は認証を検証して通常の画面に遷移
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          // 認証が無効な場合はローカルストレージをクリアしてログインモーダルを表示
          localStorage.removeItem('shift-app-auth')
          localStorage.removeItem('shift-app-push-token')
          setShowLoginModal(true)
          setIsVerifying(false)
          return
        }

        // メンテナンスモードとプロフィール情報を並列に取得
        const [maintenanceResult, profileResult] = await Promise.all([
          supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single(),
          supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        ])

        const isMaintenance = maintenanceResult.data?.value === 'true'
        setIsMaintenanceMode(isMaintenance)
        const profile = profileResult.data

        // 通常の画面に遷移
        if (isMaintenance) {
          // メンテナンスモードが有効な場合
          if (profile?.role === 'admin' || profile?.role === 'super_admin') {
            router.replace('/admin')
          } else {
            // 一般ユーザーはメンテナンスページへリダイレクト（ログアウトしない）
            router.replace('/maintenance')
          }
        } else {
          // メンテナンスモードが無効な場合、通常のリダイレクト
          if (profile?.role === 'admin' || profile?.role === 'super_admin') {
            router.replace('/admin')
          } else {
            router.replace('/dashboard')
          }
        }
      } catch (error) {
        // エラーが発生した場合はローカルストレージをクリアしてログインモーダルを表示
        console.error('認証検証エラー:', error)
        localStorage.removeItem('shift-app-auth')
        localStorage.removeItem('shift-app-push-token')
        setShowLoginModal(true)
        setIsVerifying(false)
      }
    }

    checkStoredAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // メンテナンスモードのチェック（ログインモーダル表示時のみ）
  useEffect(() => {
    if (!showLoginModal) return

    const checkMaintenanceMode = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single()

        const isMaintenance = data?.value === 'true'
        setIsMaintenanceMode(isMaintenance)
      } catch (error) {
        console.error('メンテナンスモードチェックエラー:', error)
      }
    }

    checkMaintenanceMode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLoginModal])

  // ローカルストレージに残っている古いログイン情報をクリーンアップ
  // 最終ログインから5日以上経過している場合は、端末情報と Push トークンを削除
  useEffect(() => {
    const cleanupStaleAuth = async () => {
      if (typeof window === 'undefined') return
      const raw = localStorage.getItem('shift-app-auth')
      if (!raw) return

      try {
        const parsed = JSON.parse(raw) as { lastLoginAt?: string }
        if (!parsed.lastLoginAt) return

        const last = new Date(parsed.lastLoginAt).getTime()
        const now = Date.now()
        const fiveDaysMs = 5 * 24 * 60 * 60 * 1000

        if (now - last > fiveDaysMs) {
          const token = localStorage.getItem('shift-app-push-token')
          if (token) {
            try {
              await supabase.from('push_subscriptions').delete().eq('token', token)
            } catch {
              // サーバー側削除に失敗してもローカルは消しておく
            }
          }
          localStorage.removeItem('shift-app-auth')
          localStorage.removeItem('shift-app-push-token')
        }
      } catch {
        // パースに失敗した場合も念のため削除
        localStorage.removeItem('shift-app-auth')
        localStorage.removeItem('shift-app-push-token')
      }
    }

    // 非同期関数を即時実行
    cleanupStaleAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      // 1. アカウントの存在チェック
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      })
      const checkData = await checkRes.json()

      if (!checkRes.ok || checkData.error) {
        await customAlert('アカウント確認中にエラーが発生しました: ' + (checkData.error || '不明なエラー'))
        return
      }

      if (!checkData.exists) {
        await customAlert('このメールアドレスは登録されていません。正しいアドレスを入力してください。')
        return
      }

      // 2. 存在した場合はリセットメールを送信
      const redirectTo = `${window.location.origin}/auth/callback?next=/update-password`
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      })

      if (error) {
        let msg = error.message
        if (error.status === 429 || msg.toLowerCase().includes('rate limit')) {
          msg = '短時間に複数回リクエストされたため、送信制限に達しました。しばらく時間をおいてから再度お試しください。'
        }
        await customAlert('リセットメールの送信に失敗しました:\n' + msg)
      } else {
        await customAlert('パスワードリセットメールを送信しました。メール内のリンクをクリックしてパスワードを再設定してください。')
        setShowResetModal(false)
        setResetEmail('')
      }
    } catch (err: any) {
      await customAlert('予期せぬエラーが発生しました: ' + err.message)
    } finally {
      setResetLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      await customAlert('ログイン失敗: ' + error.message)
      setLoading(false)
    } else {
      // ログイン成功後、ロールを確認して振り分け
      const user = signInData?.user
      if (!user) {
        await customAlert('ユーザー情報の取得に失敗しました')
        setLoading(false)
        return
      }

      // ローカルストレージにログイン情報を保存しておく（ログイン状態の保持用）
      try {
        localStorage.setItem(
          'shift-app-auth',
          JSON.stringify({
            userId: user.id,
            email,
            lastLoginAt: new Date().toISOString(),
          })
        )
      } catch {
        // localStorage が使えない場合は無視（Supabase 側のセッションに任せる）
      }


      // ログインボタン押下に紐づけて通知権限を取得し、トークンと user_id を登録（非同期で実行し、ログインの遷移をブロックしない）
      setupPushNotificationsForUser(user.id).catch((err) => {
        console.error('プッシュ通知設定エラー:', err)
      })

      // メンテナンスモードとプロフィール情報を並列に取得
      const [maintenanceResult, profileResult] = await Promise.all([
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single(),
        supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
      ])

      const isMaintenanceMode = maintenanceResult.data?.value === 'true'
      const profile = profileResult.data

      // メンテナンスモードが有効で、一般ユーザーの場合はメンテナンスページへリダイレクト（ログアウトしない）
      if (isMaintenanceMode && profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        router.push('/maintenance')
        setLoading(false)
        return
      }

      if (profile?.role === 'admin' || profile?.role === 'super_admin') router.push('/admin')
      else router.push('/dashboard')
    }
  }

  // 検証中の表示
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
            <div className="bg-blue-600 p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-xl mb-4 shadow-md">
                <CalendarDays className="text-blue-600" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">文化祭シフト管理</h1>
              <p className="text-blue-100 text-sm">配布されたアカウントでログイン</p>
            </div>

            <div className="p-8 sm:p-12 text-center bg-white">
              <div className="flex flex-col items-center justify-center gap-3 sm:gap-4">
                <span className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                <p className="text-base sm:text-lg font-semibold text-slate-700">検証中...</p>
                <p className="text-xs sm:text-sm text-slate-500">権限を確認しています</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ログインモーダルの表示（ログイン記録が見つからなかった場合のみ）
  if (!showLoginModal) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
          <div className="bg-blue-600 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl mb-3 sm:mb-4 shadow-md">
              <CalendarDays className="text-blue-600 w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">文化祭シフト管理</h1>
            <p className="text-blue-100 text-xs sm:text-sm">配布されたアカウントでログイン</p>
          </div>

          <form onSubmit={handleLogin} className="p-6 sm:p-8 space-y-5 sm:space-y-6 bg-white">
            {isMaintenanceMode && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-900 mb-1">
                    システムメンテナンス中
                  </p>
                  <p className="text-xs text-orange-700">
                    現在システムメンテナンス中のため、一般ユーザーはアクセスできません。管理者（および最高管理者）のみログイン可能です。
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>メールアドレス</span>
              </label>
              <input
                type="email"
                required
                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white"
                placeholder="staff@festival.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">パスワード</label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none"
                >
                  パスワードをお忘れですか？
                </button>
              </div>
              <input
                type="password"
                required
                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 sm:py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation min-h-[44px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  確認中...
                </span>
              ) : (
                <>
                  ログイン <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2 pt-2">
              <Lock size={14} className="text-slate-400" />
              <span className="font-medium">Secure Access Only</span>
            </div>
          </form>
        </div>
      </div>

      {/* パスワードリセットモーダル */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 w-full max-w-md transform transition-all duration-300">
            <div className="bg-blue-600 p-6 text-center text-white">
              <h2 className="text-xl font-bold">パスワードの再設定</h2>
              <p className="text-blue-100 text-xs mt-1">登録されているメールアドレスを入力してください</p>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">メールアドレス</label>
                <input
                  type="email"
                  required
                  className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-slate-800"
                  placeholder="staff@festival.com"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false)
                    setResetEmail('')
                  }}
                  className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-all duration-200 min-h-[44px]"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
                >
                  {resetLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    '送信する'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
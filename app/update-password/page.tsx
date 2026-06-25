'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { customAlert } from '@/lib/alert'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 6) {
      setErrorMsg('パスワードは6文字以上で入力してください。')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('パスワードが一致しません。')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        await customAlert('パスワードが正常に更新されました。ログイン画面に移動します。')
        // Clear any local storage auth state to force a fresh login with the new credentials
        localStorage.removeItem('shift-app-auth')
        localStorage.removeItem('shift-app-push-token')
        router.push('/')
      }
    } catch (err: any) {
      setErrorMsg('予期せぬエラーが発生しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200 animate-fade-in">
          <div className="bg-blue-600 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl mb-3 sm:mb-4 shadow-md">
              <Lock className="text-blue-600 w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">新しいパスワードの設定</h1>
            <p className="text-blue-100 text-xs sm:text-sm">新しいパスワードを入力して更新を完了させてください</p>
          </div>

          <form onSubmit={handleUpdatePassword} className="p-6 sm:p-8 space-y-5 sm:space-y-6 bg-white">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">新しいパスワード</label>
              <input
                type="password"
                required
                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-slate-800"
                placeholder="6文字以上のパスワード"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">パスワード（確認用）</label>
              <input
                type="password"
                required
                className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all duration-200 bg-white text-slate-800"
                placeholder="もう一度入力してください"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 sm:py-3.5 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg touch-manipulation min-h-[44px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  更新中...
                </span>
              ) : (
                <>
                  パスワードを更新する <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

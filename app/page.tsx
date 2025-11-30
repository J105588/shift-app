'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, ArrowRight, CalendarDays } from 'lucide-react'

// 動的レンダリングを強制（認証が必要なため）
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      alert('ログイン失敗: ' + error.message)
      setLoading(false)
    } else {
      // ログイン成功後、ロールを確認して振り分け
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
      
      if (profile?.role === 'admin') router.push('/admin')
      else router.push('/dashboard')
    }
  }

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
          
          <form onSubmit={handleLogin} className="p-8 space-y-6 bg-white">
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
              <label className="text-sm font-semibold text-slate-700">パスワード</label>
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
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
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
    </div>
  )
}
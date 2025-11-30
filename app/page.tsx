'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, ArrowRight, CalendarDays } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 px-4 py-12">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icGluayIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2Utb3BhY2l0eT0iMC4xNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
      
      <div className="relative w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg overflow-hidden border border-pink-100/50">
          <div className="bg-gradient-to-r from-rose-200/40 via-pink-200/40 to-fuchsia-200/40 p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-white/30 backdrop-blur-sm"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100/60 rounded-2xl mb-4 backdrop-blur-sm border border-pink-200/50">
                <CalendarDays className="text-rose-400" size={32} />
              </div>
              <h1 className="text-3xl font-bold text-rose-600 mb-2 tracking-tight">文化祭シフト管理</h1>
              <p className="text-rose-500/70 text-sm font-medium">配布されたアカウントでログイン</p>
            </div>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6 bg-white">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-rose-700/80 flex items-center gap-2">
                <span>メールアドレス</span>
              </label>
              <input 
                type="email" 
                required
                className="w-full p-4 border border-pink-200 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
                placeholder="staff@festival.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-rose-700/80">パスワード</label>
              <input 
                type="password" 
                required
                className="w-full p-4 border border-pink-200 rounded-xl focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all duration-200 bg-white/50 focus:bg-white"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button 
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-300/80 to-pink-300/80 text-rose-700 py-4 rounded-xl font-semibold hover:from-rose-300 hover:to-pink-300 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transform hover:-translate-y-0.5 border border-pink-200/50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></span>
                  確認中...
                </span>
              ) : (
                <>
                  ログイン <ArrowRight size={18} />
                </>
              )}
            </button>
            
            <div className="text-center text-xs text-rose-400/60 flex items-center justify-center gap-2 pt-2">
              <Lock size={14} className="text-rose-400" />
              <span className="font-medium">Secure Access Only</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
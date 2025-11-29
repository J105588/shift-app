'use client'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, Shield, CalendarDays, User } from 'lucide-react'

export default function Navbar({ user, profile }: { user: any, profile: any }) {
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg border-b border-white/10 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href={profile?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <CalendarDays size={20} />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">文化祭シフト</span>
              <p className="text-xs text-slate-400 hidden sm:block">管理システム</p>
            </div>
          </Link>
          
          {user && (
            <div className="flex items-center gap-3">
              {profile?.role === 'admin' && (
                <Link 
                  href="/admin" 
                  className="flex items-center gap-2 text-sm bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
                >
                  <Shield size={16} />
                  <span className="hidden sm:inline">管理者</span>
                </Link>
              )}
              <Link 
                href={profile?.role === 'admin' ? '/admin' : '/dashboard'} 
                className="hidden sm:flex items-center gap-2 text-sm text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors duration-200 font-medium"
              >
                ホーム
              </Link>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User size={14} />
                </div>
                <span className="hidden md:block text-sm font-medium">{profile?.display_name || 'ユーザー'}</span>
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-red-500/20 transition-colors duration-200 border border-transparent hover:border-red-500/30"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
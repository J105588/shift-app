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
    <nav className="bg-white text-slate-900 shadow-sm border-b border-slate-200 sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href={profile?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-2 sm:gap-3 group">
            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors duration-200 shadow-sm shrink-0">
              <CalendarDays size={18} className="text-white sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 leading-tight">文化祭シフト</span>
              <p className="text-[10px] sm:text-xs text-slate-500 hidden xs:block">管理システム</p>
            </div>
          </Link>

          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              {profile?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm font-semibold whitespace-nowrap"
                >
                  <Shield size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">管理者</span>
                </Link>
              )}

              <div className="flex items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-slate-50 border border-slate-200 max-w-[120px] sm:max-w-none">
                <div className="w-6 h-6 sm:w-7 sm:h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={12} className="text-blue-600 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{profile?.display_name || 'ユーザー'}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:gap-2 text-sm text-slate-600 hover:text-red-600 sm:px-3 sm:py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 font-medium border border-transparent hover:border-red-100"
                title="ログアウト"
              >
                <LogOut size={18} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">ログアウト</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
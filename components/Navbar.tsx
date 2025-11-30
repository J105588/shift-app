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
    <nav className="bg-white/80 backdrop-blur-sm text-rose-700 shadow-sm border-b border-pink-100/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href={profile?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-rose-200/60 to-pink-200/60 rounded-xl group-hover:scale-110 transition-transform duration-200 shadow-sm border border-pink-200/50">
              <CalendarDays size={20} className="text-rose-500" />
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-rose-600">文化祭シフト</span>
              <p className="text-xs text-rose-400/70 hidden sm:block">管理システム</p>
            </div>
          </Link>
          
          {user && (
            <div className="flex items-center gap-3">
              {profile?.role === 'admin' && (
                <Link 
                  href="/admin" 
                  className="flex items-center gap-2 text-sm bg-gradient-to-r from-rose-200/60 to-pink-200/60 px-4 py-2 rounded-lg hover:from-rose-200 hover:to-pink-200 transition-all duration-200 shadow-sm hover:shadow-md font-semibold text-rose-700 border border-pink-200/50"
                >
                  <Shield size={16} />
                  <span className="hidden sm:inline">管理者</span>
                </Link>
              )}
              <Link 
                href={profile?.role === 'admin' ? '/admin' : '/dashboard'} 
                className="hidden sm:flex items-center gap-2 text-sm text-rose-600/70 hover:text-rose-700 px-3 py-2 rounded-lg hover:bg-rose-50/50 transition-colors duration-200 font-medium"
              >
                ホーム
              </Link>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50/50 border border-pink-200/50">
                <div className="w-7 h-7 bg-gradient-to-br from-rose-200/60 to-pink-200/60 rounded-full flex items-center justify-center border border-pink-200/50">
                  <User size={14} className="text-rose-500" />
                </div>
                <span className="hidden md:block text-sm font-medium text-rose-700">{profile?.display_name || 'ユーザー'}</span>
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 text-sm text-rose-500/70 hover:text-rose-600 px-3 py-2 rounded-lg hover:bg-rose-50/50 transition-colors duration-200 border border-transparent hover:border-rose-200/50"
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
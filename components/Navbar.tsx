'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { LogOut, Shield, CalendarDays, User } from 'lucide-react'

export default function Navbar({ user, profile }: { user: any, profile: any }) {
  const supabase = createClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return // 二重送信防止
    
    setIsLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Logout error:', error)
        alert('ログアウト中にエラーが発生しました: ' + error.message)
        setIsLoggingOut(false)
        return
      }
      
      // ログアウト成功後、完全なページリロードでログインページにリダイレクト
      // これにより、すべての状態とクッキーが確実にクリアされる
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      alert('ログアウト中にエラーが発生しました')
      setIsLoggingOut(false)
    }
  }

  return (
    <nav className="bg-white text-slate-900 shadow-sm border-b border-slate-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href={profile?.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg group-hover:bg-blue-700 transition-colors duration-200 shadow-sm">
              <CalendarDays size={20} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">文化祭シフト</span>
              <p className="text-xs text-slate-500 hidden sm:block">管理システム</p>
            </div>
          </Link>
          
          {user && (
            <div className="flex items-center gap-3">
              {profile?.role === 'admin' && (
                <Link 
                  href="/admin" 
                  className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm font-semibold"
                >
                  <Shield size={16} />
                  <span className="hidden sm:inline">管理者</span>
                </Link>
              )}
              <Link 
                href={profile?.role === 'admin' ? '/admin' : '/dashboard'} 
                className="hidden sm:flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors duration-200 font-medium"
              >
                ホーム
              </Link>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={14} className="text-blue-600" />
                </div>
                <span className="hidden md:block text-sm font-semibold text-slate-900">{profile?.display_name || 'ユーザー'}</span>
              </div>
              <button 
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                {isLoggingOut ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
                    <span className="hidden sm:inline">ログアウト中...</span>
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    <span className="hidden sm:inline">ログアウト</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
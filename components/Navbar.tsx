'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { LogOut, Shield, CalendarDays, User, X } from 'lucide-react'

export default function Navbar({ user, profile }: { user: any, profile: any }) {
  const supabase = createClient()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return // 二重送信防止
    
    setIsLoggingOut(true)
    try {
      // ログアウト前に、この端末の push_subscriptions レコードとローカルストレージ情報をクリア
      try {
        const storedToken = typeof window !== 'undefined'
          ? localStorage.getItem('shift-app-push-token')
          : null
        if (storedToken) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('token', storedToken)
        }
        if (typeof window !== 'undefined') {
          localStorage.removeItem('shift-app-auth')
          localStorage.removeItem('shift-app-push-token')
        }
      } catch {
        // クライアント側のクリーンアップに失敗しても、サインアウト自体は続行
      }

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
              <button 
                onClick={() => setIsUserModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors duration-200 cursor-pointer touch-manipulation"
              >
                <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                  <User size={14} className="text-blue-600" />
                </div>
                <span className="hidden md:block text-sm font-semibold text-slate-900">{profile?.display_name || 'ユーザー'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* ユーザー情報モーダル */}
      {isUserModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300"
          onClick={() => setIsUserModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">ユーザー情報</h2>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors duration-200 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={24} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-1">ユーザー名</p>
                  <p className="text-lg font-semibold text-slate-900 truncate">
                    {profile?.display_name || 'ユーザー'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  profile?.role === 'admin' 
                    ? 'bg-purple-100' 
                    : 'bg-slate-100'
                }`}>
                  {profile?.role === 'admin' ? (
                    <Shield size={24} className="text-purple-600" />
                  ) : (
                    <User size={24} className="text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600 mb-1">権限</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {profile?.role === 'admin' ? '管理者' : '一般'}
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-center gap-2 text-sm text-white bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {isLoggingOut ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>ログアウト中...</span>
                </>
              ) : (
                <>
                  <LogOut size={16} />
                  <span>ログアウト</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
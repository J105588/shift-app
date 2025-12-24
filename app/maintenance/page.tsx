'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, CalendarDays } from 'lucide-react'

// 動的レンダリングを強制（認証が必要なため）
export const dynamic = 'force-dynamic'

export default function MaintenancePage() {
  const supabase = createClient()
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null)

  // メンテナンスモードのチェックと自動復帰
  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        setIsChecking(true)

        // ユーザー認証を確認
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // ログインしていない場合はログインページへ
          router.replace('/')
          return
        }

        // プロフィールを確認
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (!profile) {
          router.replace('/')
          return
        }

        // 管理者の場合は管理画面へ
        if (profile.role === 'admin' || profile.role === 'super_admin') {
          router.replace('/admin')
          return
        }

        // メンテナンスモードをチェック
        const { data: maintenanceSetting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single()

        const isMaintenanceMode = maintenanceSetting?.value === 'true'

        if (!isMaintenanceMode) {
          // メンテナンスモードが解除されたらダッシュボードへ
          router.replace('/dashboard')
          return
        }

        setLastCheckTime(new Date())
      } catch (error) {
        console.error('メンテナンスモードチェックエラー:', error)
      } finally {
        setIsChecking(false)
      }
    }

    // 初回チェック
    checkMaintenanceMode()

    // 5秒ごとにチェック
    const interval = setInterval(checkMaintenanceMode, 5000)

    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
          <div className="bg-orange-600 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-xl mb-3 sm:mb-4 shadow-md">
              <AlertTriangle className="text-orange-600 w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">システムメンテナンス中</h1>
            <p className="text-orange-100 text-xs sm:text-sm">現在、システムメンテナンスを実施しています</p>
          </div>

          <div className="p-6 sm:p-8 space-y-5 sm:space-y-6 bg-white">
            <div className="space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <CalendarDays className="text-orange-600 w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
                    メンテナンス中のため、一時的にご利用いただけません
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 mb-3 sm:mb-4">
                    システムのメンテナンス作業を実施中です。作業完了までしばらくお待ちください。
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm font-semibold text-red-900 mb-1">
                      ⚠ 期間中は操作・閲覧できません
                    </p>
                    <p className="text-xs text-red-700">
                      メンテナンス期間中は、シフトの確認や編集など、すべての操作ができません。
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                    <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-1">
                      ✓ 自動復帰
                    </p>
                    <p className="text-xs text-blue-700">
                      メンテナンスが完了次第、自動的にシステムに復帰できます。このページは自動的に更新されます。
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">ステータス確認</span>
                  <div className="flex items-center gap-2">
                    {isChecking ? (
                      <>
                        <span className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></span>
                        <span className="text-orange-600 font-medium">確認中...</span>
                      </>
                    ) : lastCheckTime ? (
                      <>
                        <RefreshCw size={16} className="text-slate-400" />
                        <span className="text-slate-500 text-xs">
                          {lastCheckTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">確認待機中...</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  自動的にメンテナンス状況を確認しています
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


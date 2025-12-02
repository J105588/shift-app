'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { forceReloadPwa } from '@/lib/pwa'

const UPDATE_STORAGE_KEY = 'pwa_update_version'
const CHECK_INTERVAL_MS = 30 * 1000 // 20秒ごとに最新バージョンをポーリング

export default function PwaUpdateListener() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const checkLatestVersion = async () => {
      if (typeof window === 'undefined') return
      try {
        const { data, error } = await supabase
          .from('app_updates')
          .select('version, created_at')
          .order('created_at', { ascending: false })
          .limit(1)

        if (error || !data || data.length === 0) return

        const latest = data[0]?.version as string | undefined
        if (!latest) return

        const lastApplied = localStorage.getItem(UPDATE_STORAGE_KEY)
        if (lastApplied === latest) return

        setUpdateVersion(latest)
        setIsUpdating(true)
      } catch {
        // 通信エラー時は何もしない（次回チェックに任せる）
      }
    }

    // 初回ロード時に即チェック
    checkLatestVersion()

    // 定期的にチェック
    const timer = window.setInterval(checkLatestVersion, CHECK_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  if (!isUpdating) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom rounded-xl bg-blue-600 text-white shadow-2xl border border-blue-400">
      <div className="p-4 space-y-2">
        <p className="text-sm font-semibold">新しいバージョンがあります</p>
        <p className="text-xs text-blue-100">
          アプリを再読み込みして最新のシフト表を表示します。今すぐ更新しますか？
          {updateVersion && (
            <span className="ml-1 opacity-80">({updateVersion})</span>
          )}
        </p>
        <div className="flex items-center gap-3 text-xs text-blue-50 mt-2">
          <button
            type="button"
            onClick={async () => {
              if (updateVersion) {
                localStorage.setItem(UPDATE_STORAGE_KEY, updateVersion)
              }
              await forceReloadPwa()
            }}
            className="px-3 py-1.5 rounded-md bg-white text-blue-700 text-xs font-semibold shadow-sm hover:bg-blue-50 transition-colors"
          >
            今すぐ更新
          </button>
          <button
            type="button"
            onClick={() => setIsUpdating(false)}
            className="px-3 py-1.5 rounded-md border border-blue-300/70 text-blue-50 text-xs font-semibold hover:bg-blue-500/30 transition-colors"
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  )
}


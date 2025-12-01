'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { forceReloadPwa } from '@/lib/pwa'

const UPDATE_STORAGE_KEY = 'pwa_update_version'

export default function PwaUpdateListener() {
  const supabase = useMemo(() => createClient(), [])
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel('public:app_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_updates' },
        async (payload) => {
          const version = payload.new?.version as string | undefined
          if (!version) return

          const lastApplied = localStorage.getItem(UPDATE_STORAGE_KEY)
          if (lastApplied === version) return

          localStorage.setItem(UPDATE_STORAGE_KEY, version)
          setUpdateVersion(version)
          setIsUpdating(true)

          // 少し待ってからリロードして、通知を目視できるようにする
          setTimeout(async () => {
            await forceReloadPwa()
          }, 3000)
        }
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  if (!isUpdating) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom rounded-xl bg-blue-600 text-white shadow-2xl border border-blue-400">
      <div className="p-4 space-y-2">
        <p className="text-sm font-semibold">最新バージョンを準備しています</p>
        <p className="text-xs text-blue-100">
          数秒後にアプリを再読み込みして最新のシフト表を表示します。
          {updateVersion && (
            <span className="ml-1 opacity-80">({updateVersion})</span>
          )}
        </p>
        <div className="flex items-center gap-2 text-xs text-blue-50">
          <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
          アップデートを適用中...
        </div>
      </div>
    </div>
  )
}


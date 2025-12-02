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

          setUpdateVersion(version)
          setIsUpdating(true)
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


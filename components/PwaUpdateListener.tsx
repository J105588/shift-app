'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { forceReloadPwa } from '@/lib/pwa'

const UPDATE_STORAGE_KEY = 'pwa_update_version'

export default function PwaUpdateListener() {
  const supabase = createClient()

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
          await forceReloadPwa()
        }
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return null
}


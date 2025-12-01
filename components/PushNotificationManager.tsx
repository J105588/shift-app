'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getFcmToken, subscribeInAppMessages } from '@/lib/firebaseClient'

export default function PushNotificationManager() {
  const supabase = createClient()

  useEffect(() => {
    const setup = async () => {
      if (typeof window === 'undefined') return
      if (!('Notification' in window)) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 権限リクエスト
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') return

      const token = await getFcmToken()
      if (!token) return

      // Supabaseにトークンを保存（同じトークンが既にあれば更新）
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          token,
        },
        {
          onConflict: 'token',
        }
      )

      subscribeInAppMessages()
    }

    setup()
  }, [supabase])

  return null
}



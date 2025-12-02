'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getFcmToken, subscribeInAppMessages } from '@/lib/firebaseClient'

export default function PushNotificationManager() {
  const supabase = createClient()

  useEffect(() => {
    const setup = async () => {
      if (typeof window === 'undefined') return
      
      // iOS の検出
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      
      // PWAとしてインストールされているか確認（iOSで重要）
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true

      // iOSでは、PWAとしてインストールされていない場合、通知は動作しない
      if (isIOS && !isStandalone) {
        console.warn('iOSでは、PWAとしてホーム画面に追加する必要があります。')
        console.info('Safariの共有ボタン（□↑）→「ホーム画面に追加」からインストールしてください。')
        return
      }
      
      // iOS 16.4以降では Notification API がサポートされている
      if (!('Notification' in window)) {
        if (isIOS) {
          console.warn('iOS 16.4以降が必要です。Web Push APIはiOS 16.4以降でサポートされています。')
        }
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 権限リクエスト
      let permission = Notification.permission
      const wasPermissionDefault = permission === 'default'
      
      if (permission === 'default') {
        // iOSでは、ユーザーが明示的に許可する必要がある
        try {
          permission = await Notification.requestPermission()
        } catch (error) {
          console.error('Failed to request notification permission:', error)
          return
        }
      }
      
      if (permission !== 'granted') {
        console.warn('Notification permission not granted:', permission)
        if (isIOS) {
          console.info('iOSでは、Safariの設定から通知を許可してください。')
        }
        return
      }

      // 通知が許可された直後にテスト通知を送信（初回許可時のみ）
      if (wasPermissionDefault && permission === 'granted') {
        try {
          const testNotification = new Notification('文実シフト管理', {
            body: 'これは文実によるテスト通信です',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: 'test-notification',
            requireInteraction: false,
          })

          // テスト通知を3秒後に自動的に閉じる
          setTimeout(() => {
            testNotification.close()
          }, 3000)

          console.log('テスト通知を送信しました')
        } catch (error) {
          console.error('テスト通知の送信に失敗しました:', error)
        }
      }

      // Service Worker のサポート確認（iOS 16.4以降で必要）
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker is not supported')
        if (isIOS) {
          console.info('iOS 16.4以降が必要です。')
        }
        return
      }

      const token = await getFcmToken()
      if (!token) {
        console.warn('Failed to get FCM token')
        if (isIOS) {
          console.info('iOSでは、PWAとしてホーム画面に追加してから通知を使用してください。')
        }
        return
      }

      // Supabaseにトークンを保存（同じトークンが既にあれば更新）
      const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          token,
        },
        {
          onConflict: 'token',
        }
      )

      if (upsertError) {
        console.error('Failed to save FCM token to Supabase:', upsertError)
        return
      }

      console.log('FCM token saved successfully')
      await subscribeInAppMessages()
    }

    setup()
  }, [supabase])

  return null
}



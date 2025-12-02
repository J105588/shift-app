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
      
      // PWAとしてインストールされているか確認（複数の方法で検出）
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        // iOS Safariでホーム画面から起動した場合の検出
        (isIOS && window.matchMedia('(display-mode: fullscreen)').matches) ||
        // その他の検出方法
        (isIOS && !(window.navigator as any).standalone && document.referrer === '')

      // デバッグ情報を出力
      console.log('PWA Setup:', {
        isIOS,
        isStandalone,
        displayMode: window.matchMedia('(display-mode: standalone)').matches,
        standalone: (window.navigator as any).standalone,
        hasNotification: 'Notification' in window,
        hasServiceWorker: 'serviceWorker' in navigator,
      })

      // iOS 16.4以降では Notification API がサポートされている
      if (!('Notification' in window)) {
        if (isIOS) {
          console.warn('iOS 16.4以降が必要です。Web Push APIはiOS 16.4以降でサポートされています。')
        }
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('User not authenticated, skipping notification setup')
        return
      }

      // iOSでは、PWAとしてインストールされていない場合でも通知APIを試行
      // （iOS 16.4以降では、PWAでなくても動作する場合がある）
      if (isIOS && !isStandalone) {
        console.warn('iOS: PWAとしてインストールされていない可能性がありますが、通知APIを試行します。')
        console.info('より確実に動作させるには、Safariの共有ボタン（□↑）→「ホーム画面に追加」からインストールしてください。')
      }

      // 権限リクエスト（Service Workerの登録前に試行）
      let permission = Notification.permission
      const wasPermissionDefault = permission === 'default'
      
      if (permission === 'default') {
        // iOSでは、ユーザーが明示的に許可する必要がある
        console.log('Requesting notification permission...')
        try {
          permission = await Notification.requestPermission()
          console.log('Notification permission result:', permission)
        } catch (error) {
          console.error('Failed to request notification permission:', error)
          return
        }
      } else {
        console.log('Notification permission already set:', permission)
      }
      
      if (permission !== 'granted') {
        console.warn('Notification permission not granted:', permission)
        if (isIOS) {
          console.info('iOSでは、Safariの設定から通知を許可してください。')
          console.info('設定 > Safari > 通知 で確認できます。')
        }
        return
      }

      // 通知が許可された直後にテスト通知を送信
      // 初回許可時、または既に許可されている場合でも確認のため送信
      if (permission === 'granted') {
        try {
          // 既に送信済みかどうかをチェック（同じセッション内で重複送信を防ぐ）
          const lastTestNotification = sessionStorage.getItem('test-notification-sent')
          if (!lastTestNotification || wasPermissionDefault) {
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

            console.log('✅ テスト通知を送信しました')
            sessionStorage.setItem('test-notification-sent', Date.now().toString())
          } else {
            console.log('✅ 通知許可が確認されました（テスト通知は既に送信済み）')
          }
        } catch (error) {
          console.error('❌ テスト通知の送信に失敗しました:', error)
        }
      }

      // Service Worker のサポート確認（iOS 16.4以降で必要）
      if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker is not supported')
        if (isIOS) {
          console.info('iOS 16.4以降が必要です。')
        }
        // Service Workerがなくても、通知APIは動作する場合があるので続行
      }

      // Service Workerの登録を試行（失敗しても続行）
      console.log('🔄 Service Workerの登録とFCMトークンの取得を試行中...')
      const token = await getFcmToken()
      if (!token) {
        console.warn('⚠️ FCMトークンの取得に失敗しました')
        if (isIOS) {
          console.info('💡 iOSでは、PWAとしてホーム画面に追加してから通知を使用してください。')
          console.info('📊 現在の状態:', {
            isStandalone,
            hasServiceWorker: 'serviceWorker' in navigator,
            notificationPermission: permission,
          })
        }
        // FCMトークンが取得できなくても、基本的な通知は動作する可能性がある
        // ただし、バックグラウンド通知にはFCMトークンが必要
        console.info('ℹ️ 基本的な通知（フォアグラウンド）は動作する可能性がありますが、バックグラウンド通知にはFCMトークンが必要です。')
        return
      }

      console.log('✅ FCMトークンを取得しました:', token.substring(0, 20) + '...')

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

      console.log('✅ FCMトークンをSupabaseに保存しました')
      
      // メッセージ購読を設定
      console.log('🔄 メッセージ購読を設定中...')
      await subscribeInAppMessages()
      console.log('✅ プッシュ通知の設定が完了しました！')
      console.log('📱 これで、バックグラウンド通知も受信できるようになりました。')
    }

    setup()
  }, [supabase])

  return null
}



'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getFcmToken, subscribeInAppMessages } from '@/lib/firebaseClient'
import { showSuccess, showError, showWarning, showInfo } from '@/lib/toast'

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
          const message = 'iOS 16.4以降が必要です。Web Push APIはiOS 16.4以降でサポートされています。'
          console.warn(message)
          showWarning(message)
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
        const message = 'PWAとしてインストールされていない可能性がありますが、通知APIを試行します。\nより確実に動作させるには、Safariの共有ボタン（□↑）→「ホーム画面に追加」からインストールしてください。'
        console.warn('iOS:', message)
        showInfo(message)
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
          const message = `通知許可の要求に失敗しました: ${error instanceof Error ? error.message : String(error)}`
          console.error(message)
          showError(message)
          return
        }
      } else {
        console.log('Notification permission already set:', permission)
      }
      
      if (permission !== 'granted') {
        const message = `通知許可が取得できませんでした: ${permission}${isIOS ? '\n設定 > Safari > 通知 で確認できます。' : ''}`
        console.warn(message)
        showWarning(message)
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
            showSuccess('テスト通知を送信しました')
            sessionStorage.setItem('test-notification-sent', Date.now().toString())
          } else {
            console.log('✅ 通知許可が確認されました（テスト通知は既に送信済み）')
            showInfo('通知許可が確認されました')
          }
        } catch (error) {
          const message = `テスト通知の送信に失敗しました: ${error instanceof Error ? error.message : String(error)}`
          console.error('❌', message)
          showError(message)
        }
      }

      // Service Worker のサポート確認（iOS 16.4以降で必要）
      if (!('serviceWorker' in navigator)) {
        const message = 'Service Workerがサポートされていません' + (isIOS ? '\niOS 16.4以降が必要です。' : '')
        console.warn(message)
        showWarning(message)
        // Service Workerがなくても、通知APIは動作する場合があるので続行
      }

      // Service Workerの登録を試行（失敗しても続行）
      console.log('🔄 Service Workerの登録とFCMトークンの取得を試行中...')
      const token = await getFcmToken()
      if (!token) {
        const message = `FCMトークンの取得に失敗しました${isIOS ? '\nPWAとしてホーム画面に追加してから通知を使用してください。' : ''}\n基本的な通知（フォアグラウンド）は動作する可能性がありますが、バックグラウンド通知にはFCMトークンが必要です。`
        console.warn('⚠️', message)
        showWarning(message)
        return
      }

      console.log('✅ FCMトークンを取得しました:', token.substring(0, 20) + '...')
      showSuccess('FCMトークンを取得しました')

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
        const message = `FCMトークンの保存に失敗しました: ${upsertError.message || String(upsertError)}`
        console.error(message)
        showError(message)
        return
      }

      console.log('✅ FCMトークンをSupabaseに保存しました')
      showSuccess('FCMトークンをSupabaseに保存しました')
      
      // メッセージ購読を設定
      console.log('🔄 メッセージ購読を設定中...')
      await subscribeInAppMessages()
      console.log('✅ プッシュ通知の設定が完了しました！')
      showSuccess('プッシュ通知の設定が完了しました！\nバックグラウンド通知も受信できるようになりました。')
    }

    setup()
  }, [supabase])

  return null
}



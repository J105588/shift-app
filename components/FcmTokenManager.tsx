'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getFcmToken, getFirebaseMessaging } from '@/lib/firebaseClient'
import { setupPushNotificationsForUser } from './PushNotificationManager'

/**
 * FCMトークンの定期更新とService Workerの監視を行うコンポーネント
 * - アプリ起動時にトークンを検証・更新
 * - 24時間ごとにトークンを自動更新
 * - Service Workerの状態を監視して自動再登録
 * - バックグラウンドでも通知が届くようにする
 */
export default function FcmTokenManager({ userId }: { userId: string }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // トークンを更新する関数
  const refreshToken = async (forceRefresh = false) => {
    if (typeof window === 'undefined') return

    // 通知権限が許可されていない場合はスキップ
    if (Notification.permission !== 'granted') {
      return
    }

    try {
      const supabase = createClient()
      
      // 現在のトークンを取得
      const currentToken = await getFcmToken()
      if (!currentToken) {
        // トークンが取得できない場合は、再セットアップを試行
        await setupPushNotificationsForUser(userId)
        return
      }

      // ローカルストレージに保存されているトークンと比較
      const storedToken = localStorage.getItem('shift-app-push-token')
      
      // トークンが変更されている場合、または初回の場合、または強制更新の場合のみ更新
      if (forceRefresh || storedToken !== currentToken) {
        // Supabaseにトークンを保存（RLSポリシーの問題を回避するため、明示的にINSERT/UPDATEを処理）
        const { data: existingToken } = await supabase
          .from('push_subscriptions')
          .select('id, user_id')
          .eq('token', currentToken)
          .single()

        let saveError = null

        if (existingToken) {
          // 既存のトークンがある場合
          if (existingToken.user_id === userId) {
            // 同じユーザーのトークンなので、更新不要（既に正しい）
            // ただし、念のため更新時刻を更新するためにUPDATEを実行
            const { error: updateError } = await supabase
              .from('push_subscriptions')
              .update({ user_id: userId })
              .eq('id', existingToken.id)
            saveError = updateError
          } else {
            // 別のユーザーのトークンなので、削除してから新規作成
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', existingToken.id)
            
            const { error: insertError } = await supabase
              .from('push_subscriptions')
              .insert({
                user_id: userId,
                token: currentToken,
              })
            saveError = insertError
          }
        } else {
          // 既存のトークンがない場合、新規作成
          const { error: insertError } = await supabase
            .from('push_subscriptions')
            .insert({
              user_id: userId,
              token: currentToken,
            })
          saveError = insertError
        }

        if (!saveError) {
          localStorage.setItem('shift-app-push-token', currentToken)
          
          // トークンの最終更新時刻を記録（次回の更新判定に使用）
          localStorage.setItem('shift-app-push-token-updated', Date.now().toString())
        } else {
          // 保存に失敗した場合は、次回再試行するためにフラグを立てる
          console.debug('FCM token save error:', saveError)
        }
      }
    } catch (error) {
      // エラーは静かに無視（ログに記録しない）
      console.debug('FCM token refresh error:', error)
      
      // エラーが発生した場合、次回の更新時に再試行する
      // ただし、連続してエラーが発生する場合は、再セットアップを試行
      const lastErrorTime = localStorage.getItem('shift-app-push-token-error-time')
      const now = Date.now()
      if (lastErrorTime && now - parseInt(lastErrorTime) > 60 * 60 * 1000) {
        // 1時間以上エラーが続いている場合は、再セットアップを試行
        await setupPushNotificationsForUser(userId)
      } else {
        localStorage.setItem('shift-app-push-token-error-time', now.toString())
      }
    }
  }

  // Service Workerの状態を監視して、必要に応じて再登録
  const checkServiceWorker = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    try {
      // すべてのService Worker登録を確認
      const registrations = await navigator.serviceWorker.getRegistrations()
      const hasFirebaseSW = registrations.some(reg => 
        reg.active?.scriptURL.includes('firebase-messaging-sw.js') ||
        reg.installing?.scriptURL.includes('firebase-messaging-sw.js') ||
        reg.waiting?.scriptURL.includes('firebase-messaging-sw.js')
      )

      if (!hasFirebaseSW) {
        // Service Workerが登録されていない場合は、再セットアップを試行
        if (Notification.permission === 'granted') {
          await setupPushNotificationsForUser(userId)
        }
      } else {
        // Service Workerが存在する場合でも、トークンが有効か確認
        const messagingResult = await getFirebaseMessaging()
        if (!messagingResult) {
          // Service Workerは存在するが、Messagingが取得できない場合は再セットアップ
          if (Notification.permission === 'granted') {
            await setupPushNotificationsForUser(userId)
          }
        }
      }
    } catch (error) {
      console.debug('Service Worker check error:', error)
    }
  }

  useEffect(() => {
    // アプリ起動時にトークンを検証・更新
    const initToken = async () => {
      // 少し待ってから実行（他の初期化処理が完了するのを待つ）
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      await checkServiceWorker()
      await refreshToken()
    }

    initToken()

    // 24時間ごとにトークンを更新（ミリ秒単位）
    const TOKEN_REFRESH_INTERVAL = 24 * 60 * 60 * 1000 // 24時間
    intervalRef.current = setInterval(() => {
      refreshToken(true) // 強制更新
    }, TOKEN_REFRESH_INTERVAL)

    // 30分ごとにService Workerの状態をチェック
    const SW_CHECK_INTERVAL = 30 * 60 * 1000 // 30分
    checkIntervalRef.current = setInterval(() => {
      checkServiceWorker()
    }, SW_CHECK_INTERVAL)

    // ページがフォーカスされたときにもトークンをチェック
    const handleFocus = () => {
      refreshToken()
    }
    window.addEventListener('focus', handleFocus)

    // ページが表示されたときにもトークンをチェック（PWAがバックグラウンドから復帰した場合）
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshToken()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // クリーンアップ
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // このコンポーネントはUIを表示しない
  return null
}


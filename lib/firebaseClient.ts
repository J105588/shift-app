import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const initFirebaseApp = () => {
  if (typeof window === 'undefined') return null
  if (!firebaseConfig.apiKey) {
    return null
  }
  if (!getApps().length) {
    initializeApp(firebaseConfig)
  }
  return true
}

/**
 * Service Worker の登録を待つ
 * Firebase Cloud Messaging 用に /firebase-messaging-sw.js を登録する
 * iOS 16.4以降でも動作するように最適化
 */
const waitForServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  // iOS の検出（簡易版）
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // PWAとしてインストールされているか確認（複数の方法で検出）
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    // iOS Safariでホーム画面から起動した場合の検出
    (isIOS && window.matchMedia('(display-mode: fullscreen)').matches)

  try {
    // 既に登録されている Service Worker を取得
    // まず、FCM専用スコープで検索
    let registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope')
    
    // 見つからない場合は、ルートスコープで検索（iOSの場合）
    if (!registration && isIOS) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const found = registrations.find(reg => 
        reg.active?.scriptURL.includes('firebase-messaging-sw.js') ||
        reg.installing?.scriptURL.includes('firebase-messaging-sw.js') ||
        reg.waiting?.scriptURL.includes('firebase-messaging-sw.js')
      )
      if (found) {
        registration = found
      }
    }

    if (!registration) {
      // 登録されていない場合は、firebase-messaging-sw.js を登録
      // iOSでは、PWAとしてインストールされていない場合でも試行（iOS 16.4以降では動作する場合がある）
      if (isIOS && !isStandalone) {
        // iOS では PWA としてインストールされていない場合でも、可能であれば登録を試みる
      }

      try {
        // まず、FCM専用スコープで登録を試みる
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/firebase-cloud-messaging-push-scope'
        })
      } catch (registerError) {
        // iOSでスコープ指定が問題になる場合があるため、ルートスコープで再試行
        if (isIOS) {
          // iOS ではスコープ指定が原因で失敗する場合があるため、ルートスコープで再試行
          try {
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
              scope: '/'
            })
          } catch (rootScopeError) {
            return null
          }
        } else {
          throw registerError
        }
      }
    }

    // Service Worker がアクティブになるまで待つ
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        const installingWorker = registration.installing
        if (installingWorker) {
          installingWorker.addEventListener('statechange', function() {
            if (this.state === 'installed' || this.state === 'activated') {
              resolve()
            }
          })
        } else {
          resolve()
        }
      })
    } else if (registration.waiting) {
      // 待機中の場合は activate を要求
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      await new Promise<void>((resolve) => {
        const waitingWorker = registration.waiting
        if (waitingWorker) {
          waitingWorker.addEventListener('statechange', function() {
            if (this.state === 'activated') {
              resolve()
            }
          })
        } else {
          resolve()
        }
      })
    }

    // アクティブな Service Worker が存在することを確認
    if (!registration.active) {
      return null
    }

    return registration
  } catch (error) {
    return null
  }
}

export const getFirebaseMessaging = async (): Promise<{
  messaging: Messaging
  registration: ServiceWorkerRegistration
} | null> => {
  if (typeof window === 'undefined') return null
  const ok = initFirebaseApp()
  if (!ok) return null

  try {
    // Service Worker の登録を待つ（Firebase が自動的に検出できるように）
    const registration = await waitForServiceWorker()
    if (!registration) {
      return null
    }

    // Firebase は自動的に Service Worker を検出する
    // Service Worker がアクティブであることを確認
    if (!registration.active) {
      return null
    }

    const messaging = getMessaging()
    return { messaging, registration }
  } catch (e) {
    return null
  }
}

export const getFcmToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null

  // 一部ブラウザ（特に古い環境など）では ServiceWorker はあっても PushManager が未実装の場合がある
  // その場合に Firebase SDK 内部で pushManager アクセス時のエラーが出るのを防ぐ
  if (!('PushManager' in window)) {
    return null
  }

  const messagingResult = await getFirebaseMessaging()
  if (!messagingResult) return null

  const { messaging, registration } = messagingResult

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })
    return token || null
  } catch (e) {
    return null
  }
}

export const subscribeInAppMessages = async () => {
  const messagingResult = await getFirebaseMessaging()
  if (!messagingResult) return

  // フォアグラウンド時の通知表示を追跡（重複防止用）
  const shownNotificationTags = new Set<string>()

  onMessage(messagingResult.messaging, (payload) => {
    // フォアグラウンド時の通知表示
    // 注意: フォアグラウンド時は onMessage のみが発火し、
    // Service Worker の onBackgroundMessage は発火しないため、ここで表示する
    // ただし、同じ messageId の通知が既に表示されている場合は重複を避ける
    if (payload.notification) {
      const { title, body, icon } = payload.notification
      
      // ブラウザの通知APIを使用（iOS 16.4以降でサポート）
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          // 同じ messageId の通知が既に表示されている場合は重複を避ける
          const tag = payload.messageId || 
                     payload.fcmMessageId || 
                     payload.data?.messageId || 
                     `fcm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
          
          // 既に同じ tag の通知を表示済みの場合はスキップ
          if (shownNotificationTags.has(tag)) {
            return
          }
          shownNotificationTags.add(tag)

          // 古いタグをクリーンアップ（メモリリーク防止）
          if (shownNotificationTags.size > 100) {
            const oldestTag = Array.from(shownNotificationTags)[0]
            shownNotificationTags.delete(oldestTag)
          }

          const notification = new Notification(title || '通知', {
            body: body || '',
            icon: icon || '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: tag, // 同じ tag の通知は1つだけ表示される
            data: payload.data || {},
          })

          // 通知が閉じられたらタグを削除
          notification.onclose = () => {
            shownNotificationTags.delete(tag)
          }

          // 通知クリック時の処理
          notification.onclick = (event) => {
            event.preventDefault()
            window.focus()
            
            // 通知の data に URL が含まれている場合はそのページを開く
            if (payload.data && payload.data.url) {
              window.open(payload.data.url, '_blank')
            }
            
            notification.close()
            shownNotificationTags.delete(tag)
          }
        } catch (error) {
          // 通知表示エラーは静かに無視
        }
      }
    }
  })
}



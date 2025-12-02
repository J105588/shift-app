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
    console.warn('Firebase config is missing. Skipping push notification setup.')
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

  // PWAとしてインストールされているか確認（iOSで重要）
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true

  try {
    // 既に登録されている Service Worker を取得
    // まず、FCM専用スコープで検索
    let registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope')
    
    // 見つからない場合は、ルートスコープで検索（iOSの場合）
    if (!registration && isIOS) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const found = registrations.find(reg => 
        reg.active?.scriptURL.includes('firebase-messaging-sw.js')
      )
      if (found) {
        registration = found
      }
    }

    if (!registration) {
      // 登録されていない場合は、firebase-messaging-sw.js を登録
      // iOSでは、PWAとしてインストールされている必要がある
      if (isIOS && !isStandalone) {
        console.warn('iOSでは、PWAとしてホーム画面に追加する必要があります。')
        return null
      }

      try {
        // まず、FCM専用スコープで登録を試みる
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/firebase-cloud-messaging-push-scope'
        })
      } catch (registerError) {
        // iOSでスコープ指定が問題になる場合があるため、ルートスコープで再試行
        if (isIOS) {
          console.warn('Failed to register with custom scope, trying root scope:', registerError)
          try {
            registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
              scope: '/'
            })
          } catch (rootScopeError) {
            console.error('Failed to register service worker with root scope:', rootScopeError)
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
      console.warn('Service Worker is not active')
      return null
    }

    return registration
  } catch (error) {
    console.error('Failed to register service worker:', error)
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
      console.warn('Service Worker registration not available')
      return null
    }

    // Firebase は自動的に Service Worker を検出する
    // Service Worker がアクティブであることを確認
    if (!registration.active) {
      console.warn('Service Worker is not active yet')
      return null
    }

    const messaging = getMessaging()
    return { messaging, registration }
  } catch (e) {
    console.warn('Failed to get Firebase Messaging:', e)
    return null
  }
}

export const getFcmToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null
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
    console.error('Failed to get FCM token:', e)
    return null
  }
}

export const subscribeInAppMessages = async () => {
  const messagingResult = await getFirebaseMessaging()
  if (!messagingResult) return

  onMessage(messagingResult.messaging, (payload) => {
    console.log('FCM message received in page:', payload)
    
    // iOSを含むフォアグラウンド時の通知表示
    // iOS 16.4以降では、Service Worker経由の通知も動作しますが、
    // フォアグラウンド時は明示的に通知を表示する必要があります
    if (payload.notification) {
      const { title, body, icon } = payload.notification
      
      // ブラウザの通知APIを使用（iOS 16.4以降でサポート）
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const notification = new Notification(title || '通知', {
            body: body || '',
            icon: icon || '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: payload.messageId || 'fcm-notification',
            data: payload.data || {},
          })

          // 通知クリック時の処理
          notification.onclick = (event) => {
            event.preventDefault()
            window.focus()
            
            // 通知の data に URL が含まれている場合はそのページを開く
            if (payload.data && payload.data.url) {
              window.open(payload.data.url, '_blank')
            }
            
            notification.close()
          }
        } catch (error) {
          console.error('Failed to show notification:', error)
        }
      }
    }
  })
}



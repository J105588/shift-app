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
 * Firebase はデフォルトでルートスコープの Service Worker を探します
 */
const waitForServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    // 既に登録されている Service Worker を取得（ルートスコープ）
    const registrations = await navigator.serviceWorker.getRegistrations()
    let registration = registrations.find(reg => 
      reg.scope === window.location.origin + '/' || 
      reg.active?.scriptURL.includes('firebase-messaging-sw.js')
    )
    
    if (!registration) {
      // 登録されていない場合は、firebase-messaging-sw.js をルートスコープで登録
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      })
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

export const getFirebaseMessaging = async (): Promise<Messaging | null> => {
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

    return getMessaging()
  } catch (e) {
    console.warn('Failed to get Firebase Messaging:', e)
    return null
  }
}

export const getFcmToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null
  const messaging = await getFirebaseMessaging()
  if (!messaging) return null

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  try {
    const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined)
    return token || null
  } catch (e) {
    console.error('Failed to get FCM token:', e)
    return null
  }
}

export const subscribeInAppMessages = async () => {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return

  onMessage(messaging, (payload) => {
    console.log('FCM message received in page:', payload)
  })
}



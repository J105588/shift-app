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

export const getFirebaseMessaging = (): Messaging | null => {
  if (typeof window === 'undefined') return null
  const ok = initFirebaseApp()
  if (!ok) return null
  try {
    return getMessaging()
  } catch (e) {
    console.warn('Failed to get Firebase Messaging:', e)
    return null
  }
}

export const getFcmToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null
  const messaging = getFirebaseMessaging()
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

export const subscribeInAppMessages = () => {
  const messaging = getFirebaseMessaging()
  if (!messaging) return

  onMessage(messaging, (payload) => {
    console.log('FCM message received in page:', payload)
  })
}



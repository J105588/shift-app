import type { ToastMessage } from '@/components/NotificationToast'

type ToastCallback = (message: ToastMessage) => void

let toastCallback: ToastCallback | null = null

export const setToastCallback = (callback: ToastCallback) => {
  toastCallback = callback
}

export const showToast = (type: ToastMessage['type'], message: string) => {
  if (!toastCallback) {
    // フォールバック: コンソールに出力
    console.log(`[${type.toUpperCase()}] ${message}`)
    return
  }

  const toast: ToastMessage = {
    id: `toast-${Date.now()}-${Math.random()}`,
    type,
    message,
    timestamp: Date.now(),
  }

  toastCallback(toast)
}

export const showSuccess = (message: string) => showToast('success', message)
export const showError = (message: string) => showToast('error', message)
export const showWarning = (message: string) => showToast('warning', message)
export const showInfo = (message: string) => showToast('info', message)


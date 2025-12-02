import type { ToastMessage } from '@/components/NotificationToast'

type ToastCallback = (message: ToastMessage) => void

let toastCallback: ToastCallback | null = null

export const setToastCallback = (callback: ToastCallback) => {
  toastCallback = callback
}

type ToastOptions = {
  actionLabel?: string
  onAction?: () => void
}

export const showToast = (
  type: ToastMessage['type'],
  message: string,
  options?: ToastOptions
) => {
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
    actionLabel: options?.actionLabel,
    onAction: options?.onAction,
  }

  toastCallback(toast)
}

export const showSuccess = (message: string) => showToast('success', message)
export const showError = (message: string) => showToast('error', message)
export const showWarning = (message: string, options?: ToastOptions) =>
  showToast('warning', message, options)
export const showInfo = (message: string) => showToast('info', message)


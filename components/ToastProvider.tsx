'use client'

import { useEffect, useState } from 'react'
import NotificationToast from './NotificationToast'
import type { ToastMessage } from './NotificationToast'
import { setToastCallback } from '@/lib/toast'

export default function ToastProvider() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  useEffect(() => {
    // トーストコールバックを設定
    setToastCallback((message) => {
      setMessages((prev) => [...prev, message])

      // 自動的に5秒後に削除（エラーは10秒、アクション付きは15秒）
      const timeout = message.onAction
        ? 15000
        : message.type === 'error'
        ? 10000
        : 5000
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== message.id))
      }, timeout)
    })
  }, [])

  const handleDismiss = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return <NotificationToast messages={messages} onDismiss={handleDismiss} />
}


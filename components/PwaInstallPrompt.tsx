'use client'

import { useEffect, useState } from 'react'

// Chrome などで使用される beforeinstallprompt イベントの簡易型定義
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const detectStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    // iOS の検出
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(ios)

    setIsStandalone(detectStandalone())

    // iOS: ホーム画面追加の案内（24時間に1回）
    if (ios && !detectStandalone()) {
      const lastShown = localStorage.getItem('pwa-install-prompt-shown')
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000

      if (!lastShown || now - parseInt(lastShown) > oneDay) {
        setShowPrompt(true)
      }
    }

    // Android/PC: beforeinstallprompt をキャッチしてカスタムバナーを表示
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const bipEvent = e as BeforeInstallPromptEvent
      setInstallEvent(bipEvent)
      setShowPrompt(true)
    }

    // インストール完了時はバナーを閉じる
    const handleInstalled = () => {
      setShowPrompt(false)
      localStorage.setItem('pwa-installed', 'true')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    // 表示モードが変わった場合（PWA起動など）に再計算
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => setIsStandalone(detectStandalone())
    mediaQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-prompt-shown', Date.now().toString())
  }

  const handleInstall = async () => {
    if (!installEvent) return
    try {
      await installEvent.prompt()
      await installEvent.userChoice
    } finally {
      setInstallEvent(null)
      setShowPrompt(false)
      localStorage.setItem('pwa-install-prompt-shown', Date.now().toString())
    }
  }

  if (!showPrompt || isStandalone) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                {isIOS ? 'ホーム画面に追加' : 'アプリをインストール'}
              </h3>
              <p className="text-xs text-gray-600">
                {isIOS
                  ? '通知を受け取るには、このアプリをホーム画面に追加してください。'
                  : 'より高速に開けるよう、ホーム画面やアプリとしてインストールできます。'}
              </p>
            </div>

            {isIOS ? (
              <div className="text-xs text-gray-500 space-y-1">
                <p>1. Safariの共有ボタン（□↑）をタップ</p>
                <p>2. 「ホーム画面に追加」を選択</p>
                <p>3. ホーム画面のアイコンから起動</p>
              </div>
            ) : installEvent ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstall}
                  className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors"
                >
                  インストール
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                >
                  あとで
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                ブラウザの「インストール」や「アプリとして開く」を選択するとホーム画面に追加されます。
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

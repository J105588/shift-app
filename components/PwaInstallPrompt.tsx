'use client'

import { useEffect, useState } from 'react'

export default function PwaInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // iOS の検出
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(ios)

    // PWAとしてインストールされているか確認
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    setIsStandalone(standalone)

    // iOSで、PWAとしてインストールされていない場合のみプロンプトを表示
    if (ios && !standalone) {
      // ローカルストレージで既に表示したか確認（24時間以内は表示しない）
      const lastShown = localStorage.getItem('pwa-install-prompt-shown')
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000

      if (!lastShown || (now - parseInt(lastShown)) > oneDay) {
        setShowPrompt(true)
      }
    }
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-prompt-shown', Date.now().toString())
  }

  if (!showPrompt || isStandalone) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {isIOS ? 'ホーム画面に追加' : 'アプリをインストール'}
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              {isIOS 
                ? '通知を受け取るには、このアプリをホーム画面に追加してください。'
                : 'このアプリをインストールして、より快適にご利用ください。'}
            </p>
            {isIOS && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>1. Safariの共有ボタン（□↑）をタップ</p>
                <p>2. 「ホーム画面に追加」を選択</p>
                <p>3. ホーム画面のアイコンから起動</p>
              </div>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="ml-2 text-gray-400 hover:text-gray-600"
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


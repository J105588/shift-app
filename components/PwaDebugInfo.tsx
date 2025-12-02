'use client'

import { useEffect, useState } from 'react'

export default function PwaDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      (isIOS && window.matchMedia('(display-mode: fullscreen)').matches)

    const info = {
      isIOS,
      isStandalone,
      displayMode: window.matchMedia('(display-mode: standalone)').matches,
      standalone: (window.navigator as any).standalone,
      hasNotification: 'Notification' in window,
      notificationPermission: 'Notification' in window ? Notification.permission : 'N/A',
      hasServiceWorker: 'serviceWorker' in navigator,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      referrer: document.referrer,
    }

    setDebugInfo(info)

    // 開発環境またはデバッグモードの場合のみ表示
    if (process.env.NODE_ENV === 'development' || window.location.search.includes('debug=true')) {
      setShowDebug(true)
    }
  }, [])

  if (!showDebug || !debugInfo) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <div className="bg-gray-900 text-white rounded-lg shadow-lg border border-gray-700 p-4 text-xs">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold">PWA Debug Info</h3>
          <button
            onClick={() => setShowDebug(false)}
            className="text-gray-400 hover:text-white"
            aria-label="閉じる"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-1 overflow-auto max-h-64">
          {Object.entries(debugInfo).map(([key, value]) => (
            <div key={key} className="flex">
              <span className="font-mono text-gray-400 w-32">{key}:</span>
              <span className="font-mono text-gray-200 flex-1 break-all">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700">
          <button
            onClick={async () => {
              if ('Notification' in window && Notification.permission === 'default') {
                const permission = await Notification.requestPermission()
                alert(`Notification permission: ${permission}`)
                window.location.reload()
              } else {
                alert(`Notification permission: ${Notification.permission}`)
              }
            }}
            className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
          >
            Request Notification Permission
          </button>
        </div>
      </div>
    </div>
  )
}


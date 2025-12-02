'use client'

import { useEffect } from 'react'

/**
 * vConsole - モバイルデバイスでのデバッグ用コンソール
 * 環境変数 NEXT_PUBLIC_ENABLE_VCONSOLE=true で有効化
 * または開発環境（NODE_ENV=development）で自動的に有効化
 */
export default function VConsole() {
  useEffect(() => {
    // 開発環境または環境変数で有効化されている場合のみ読み込む
    const isDevelopment = process.env.NODE_ENV === 'development'
    const isEnabled = process.env.NEXT_PUBLIC_ENABLE_VCONSOLE === 'true'
    
    if (!isDevelopment && !isEnabled) {
      return
    }

    // 動的インポートでvConsoleを読み込む（SSRを避けるため）
    import('vconsole').then((module) => {
      const VConsole = module.default
      // 既にインスタンスが存在する場合は作成しない
      if (typeof window !== 'undefined' && !(window as any).__vconsole) {
        const vConsole = new VConsole({
          theme: 'dark', // 'light' または 'dark'
          defaultPlugins: ['system', 'network', 'element', 'storage'],
          maxLogNumber: 1000,
          onReady: () => {
            console.log('vConsole is ready')
          },
          onClearLog: () => {
            console.log('vConsole log cleared')
          },
        })
        // グローバルに保存（重複インスタンス防止）
        ;(window as any).__vconsole = vConsole
      }
    }).catch((error) => {
      console.error('Failed to load vConsole:', error)
    })

    // クリーンアップ（必要に応じて）
    return () => {
      // vConsoleは通常、ページ遷移時も残すので、ここでは削除しない
      // 削除したい場合は以下のコメントを外す
      // if (typeof window !== 'undefined' && (window as any).__vconsole) {
      //   (window as any).__vconsole.destroy()
      //   delete (window as any).__vconsole
      // }
    }
  }, [])

  return null
}


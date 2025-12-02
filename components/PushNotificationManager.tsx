import { createClient } from '@/lib/supabase'
import { getFcmToken, subscribeInAppMessages } from '@/lib/firebaseClient'
import { showSuccess, showError, showWarning } from '@/lib/toast'

/**
 * ログインボタン押下時に呼び出される、PWA通知権限とFCMトークン登録用の関数
 * - Notification.requestPermission は必ずユーザー操作（ログインボタン）から呼び出される
 * - 取得したトークンは Supabase の push_subscriptions テーブルに user_id と紐付けて保存する
 */
export const setupPushNotificationsForUser = async (userId: string) => {
  if (typeof window === 'undefined') return

  // iOS の検出
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // 通知 API が使えない環境
  if (!('Notification' in window)) {
    if (isIOS) {
      const message =
        'この端末では Web Push 通知がサポートされていません（iOS 16.4 以降が必要です）。'
      showWarning(message)
    }
    return
  }

  // 権限リクエスト
  let permission = Notification.permission

  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission()
    } catch (error) {
      const message = `通知許可の要求に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`
      showError(message)
      return
    }
  }

  if (permission !== 'granted') {
    const message = `通知許可が取得できませんでした: ${permission}${
      isIOS ? '\n設定 > Safari > 通知 で確認できます。' : ''
    }`
    showWarning(message)
    return
  }

  // FCM トークン取得
  const token = await getFcmToken()
  if (!token) {
    const message = `FCMトークンの取得に失敗しました${
      isIOS ? '\nPWAとしてホーム画面に追加してから通知を使用してください。' : ''
    }`
    showWarning(message)
    return
  }

  const supabase = createClient()

  // Supabase にトークンを保存（同じトークンが既にあれば更新）
  const { error: upsertError } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      token,
    },
    {
      onConflict: 'token',
    }
  )

  if (upsertError) {
    const message = `FCMトークンの保存に失敗しました: ${
      upsertError.message || String(upsertError)
    }`
    showError(message)
    return
  }

  showSuccess('通知設定が完了しました')

  // フォアグラウンド通知の購読（任意・静かな処理）
  await subscribeInAppMessages()
}

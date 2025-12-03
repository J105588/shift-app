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

  // FCM トークン取得（自動再試行付き）
  let token: string | null = null
  const maxRetries = 3
  const retryDelays = [2000, 5000, 10000] // 2秒、5秒、10秒後に再試行

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    token = await getFcmToken()
    if (token) {
      break // 成功したらループを抜ける
    }

    // 最後の試行で失敗した場合のみ警告を表示
    if (attempt === maxRetries) {
      const message = `FCMトークンの取得に失敗しました（${maxRetries + 1}回試行しました）${
        isIOS ? '\nPWAとしてホーム画面に追加してから通知を使用してください。' : ''
      }`
      showWarning(message, {
        actionLabel: '再試行',
        onAction: () => {
          // ユーザー操作に紐づいたコールバックとして再度セットアップを試行
          void setupPushNotificationsForUser(userId)
        },
      })
      return
    }

    // 次の再試行まで待機
    await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]))
  }

  if (!token) {
    // 念のため最終チェック
    return
  }

  const supabase = createClient()

  // 同じ user_id で既存のトークンがある場合、古いものを削除（最新の1つだけを残す）
  try {
    const { data: existingTokens } = await supabase
      .from('push_subscriptions')
      .select('id, token, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (existingTokens && existingTokens.length > 0) {
      // 最新のトークン以外を削除
      const tokensToDelete = existingTokens.slice(1)
      for (const oldToken of tokensToDelete) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', oldToken.id)
      }
    }
  } catch {
    // 古いトークンの削除に失敗しても、新しいトークンの保存は続行
  }

  // Supabase にトークンを保存（同じトークンが既にあれば更新）
  // RLSポリシーの問題を回避するため、まず既存のトークンを確認
  const { data: existingToken } = await supabase
    .from('push_subscriptions')
    .select('id, user_id')
    .eq('token', token)
    .single()

  if (existingToken) {
    // 既存のトークンがある場合
    if (existingToken.user_id === userId) {
      // 同じユーザーのトークンなので、更新不要（既に正しい）
      // ただし、念のため更新時刻を更新するためにUPDATEを実行
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({ user_id: userId })
        .eq('id', existingToken.id)
      
      if (updateError) {
        const message = `FCMトークンの更新に失敗しました: ${
          updateError.message || String(updateError)
        }`
        showError(message)
        return
      }
    } else {
      // 別のユーザーのトークンなので、削除してから新規作成
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', existingToken.id)
      
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          token,
        })
      
      if (insertError) {
        const message = `FCMトークンの保存に失敗しました: ${
          insertError.message || String(insertError)
        }`
        showError(message)
        return
      }
    }
  } else {
    // 既存のトークンがない場合、新規作成
    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        token,
      })
    
    if (insertError) {
      const message = `FCMトークンの保存に失敗しました: ${
        insertError.message || String(insertError)
      }`
      showError(message)
      return
    }
  }

  showSuccess('通知設定が完了しました')

  // ローカルストレージにも、この端末の最新トークンを保存しておく
  // 明示的なログアウトや長期間の未使用時にクリーンアップするために利用
  try {
    localStorage.setItem('shift-app-push-token', token)
  } catch {
    // localStorage が使えない環境では特に何もしない
  }

  // フォアグラウンド通知の購読（任意・静かな処理）
  await subscribeInAppMessages()
}

/**
 * GAS Webhookを呼び出して、作成された通知を即座に送信する共通ユーティリティ
 * @param notificationIds 送信する通知レコードのIDリスト
 * @returns Webhook呼び出しの成否
 */
export async function sendNotificationsWebhook(notificationIds: string[]): Promise<boolean> {
  if (!notificationIds || notificationIds.length === 0) {
    return false
  }

  const gasWebhookUrl = process.env.NEXT_PUBLIC_GAS_WEBHOOK_URL

  console.log('GAS Webhook URL:', gasWebhookUrl ? '設定されています' : '未設定')
  console.log('通知IDリスト:', notificationIds)

  if (!gasWebhookUrl) {
    console.warn(
      'NEXT_PUBLIC_GAS_WEBHOOK_URLが設定されていません。通知は通常の定期実行バッチで送信されます。'
    )
    return false
  }

  try {
    console.log('GAS Webhookにリクエストを送信中...', gasWebhookUrl)
    
    // Webhook呼び出し
    await fetch(gasWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_ids: notificationIds,
      }),
      mode: 'no-cors', // CORSエラーを回避（GASのWebhookはno-corsが必要な場合がある）
    })

    // no-corsモードではresponseの中身を読み取れないため、例外が発生しなかった時点で送信完了とみなす
    console.log('GAS Webhookリクエスト送信完了')
    return true
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('GAS Webhook呼び出しエラー:', err)
    console.error('エラー詳細:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    })
    return false
  }
}

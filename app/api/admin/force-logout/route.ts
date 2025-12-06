import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // 1. 特権モードでSupabaseに接続
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables')
    return NextResponse.json(
      { error: 'サーバー設定エラー: サーバーの環境変数が設定されていません' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await request.json()
    const { targetUserId, newPassword, adminPassword } = body

    // バリデーション
    if (!targetUserId) {
      return NextResponse.json(
        { error: '対象ユーザーIDは必須です' },
        { status: 400 }
      )
    }

    if (!newPassword || newPassword.trim() === '') {
      return NextResponse.json(
        { error: '新しいパスワードは必須です' },
        { status: 400 }
      )
    }

    if (!adminPassword) {
      return NextResponse.json(
        { error: '認証パスワードは必須です' },
        { status: 400 }
      )
    }

    // 2. 環境変数の特殊パスワードを確認
    const requiredPassword = process.env.ADMIN_FORCE_LOGOUT_PASSWORD
    
    if (!requiredPassword) {
      console.error('ADMIN_FORCE_LOGOUT_PASSWORD environment variable is not set')
      return NextResponse.json(
        { error: 'サーバー設定エラー: 認証パスワードが設定されていません' },
        { status: 500 }
      )
    }

    if (adminPassword !== requiredPassword) {
      return NextResponse.json(
        { error: '認証パスワードが正しくありません' },
        { status: 401 }
      )
    }

    // 4. 対象ユーザーが存在するか確認
    const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    
    if (getUserError || !targetUser?.user) {
      return NextResponse.json(
        { error: '対象ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // 5. 対象ユーザーのすべてのセッションを無効化
    // Supabase Admin APIでユーザーのパスワードをリセットすることで、すべてのセッションを無効化
    // ただし、パスワードを変更するとユーザーがログインできなくなるため、
    // 代わりにすべてのセッショントークンを削除する方法を使用
    // 実際には、Supabaseでは直接セッションを無効化するAPIがないため、
    // push_subscriptionsからトークンを削除することで、実質的にログアウト状態にする
    
    // 6. push_subscriptionsから対象ユーザーのトークンをすべて削除
    const { error: deleteTokensError } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', targetUserId)

    if (deleteTokensError) {
      console.error('Delete tokens error:', deleteTokensError)
      // トークン削除の失敗は致命的ではないので続行
    }

    // 7. セッションを無効化するために、ユーザーのパスワードを指定されたパスワードに変更
    // これにより、すべてのセッションが無効化される
    const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    if (currentUser?.user) {
      // 指定されたパスワードに変更（これによりすべてのセッションが無効化される）
      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password: newPassword }
      )

      if (updatePasswordError) {
        console.error('Update password error:', updatePasswordError)
        return NextResponse.json(
          { error: 'パスワードの変更に失敗しました: ' + updatePasswordError.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'ユーザーを強制的にログアウトしました。パスワードも変更されました。',
      newPassword: newPassword // 新しいパスワードを返す（表示用）
    }, { status: 200 })

  } catch (error: any) {
    console.error('Force logout error:', error)
    const errorMessage = error?.message || error?.toString() || '強制ログアウト中にエラーが発生しました'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: 400 }
    )
  }
}


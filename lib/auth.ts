import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export type AuthVerificationResult = {
  error?: string
  status?: number
  requesterUser?: any
  role?: 'admin' | 'super_admin' | 'staff'
}

/**
 * サーバーサイド（APIルート）でリクエスト送信元のユーザーセッションおよび管理者権限を検証するガード関数
 */
export async function verifyAdminRequest(): Promise<AuthVerificationResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables in verifyAdminRequest')
    return { error: 'サーバー設定エラー: 環境変数が設定されていません', status: 500 }
  }

  try {
    const cookieStore = await cookies()
    const supabaseRequest = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // ignored
            }
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabaseRequest.auth.getUser()

    if (userError || !user) {
      return { error: '認証エラー: ログインしてください', status: 401 }
    }

    // 特権クライアントでプロフィールを検索してロールを確認
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { error: '認証エラー: ユーザープロフィールが見つかりません', status: 401 }
    }

    if (profile.role !== 'admin' && profile.role !== 'super_admin') {
      return { error: '権限エラー: 管理者権限が必要です', status: 403 }
    }

    return { requesterUser: user, role: profile.role as 'admin' | 'super_admin' }
  } catch (error) {
    console.error('Verify admin request error:', error)
    return { error: '認証処理中に予期せぬエラーが発生しました', status: 500 }
  }
}

import { createClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/auth'

export async function GET() {
  // 管理者認証チェック
  const { error: authError, status: authStatus } = await verifyAdminRequest()
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authStatus })
  }
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
    // 2. プロフィール情報を取得
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (profilesError) {
      throw profilesError
    }

    // 3. メールアドレス情報を別クエリで一括取得（結合エラーを防ぐため別クエリ化）
    const { data: emails, error: emailsError } = await supabaseAdmin
      .from('user_emails')
      .select('id, email')

    if (emailsError) {
      console.error('Error fetching user emails:', emailsError)
    }

    const emailMap = new Map(emails?.map(e => [e.id, e.email]) || [])

    // 4. レスポンス用にフラットな構造にマッピング
    const usersWithEmail = profiles?.map(profile => {
      const email = emailMap.get(profile.id) || null
      return {
        ...profile,
        email
      }
    }) || []

    return NextResponse.json({
      success: true,
      users: usersWithEmail
    }, { status: 200 })

  } catch (error) {
    console.error('Get users error:', error)
    const errorMessage = (error as Error)?.message || String(error) || 'ユーザー一覧の取得中にエラーが発生しました'

    return NextResponse.json(
      {
        error: errorMessage,
        success: false
      },
      { status: 400 }
    )
  }
}


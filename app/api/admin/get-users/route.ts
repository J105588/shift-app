import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
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

    // 3. 各ユーザーのメールアドレスを取得
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('Error listing auth users:', authError)
      // メールアドレス取得に失敗してもプロフィール情報は返す
    }

    // 4. プロフィールとメールアドレスを結合
    const usersWithEmail = profiles?.map(profile => {
      const authUser = authUsers?.users?.find(u => u.id === profile.id)
      return {
        ...profile,
        email: authUser?.email || null
      }
    }) || []

    return NextResponse.json({
      success: true,
      users: usersWithEmail
    }, { status: 200 })

  } catch (error: any) {
    console.error('Get users error:', error)
    const errorMessage = error?.message || error?.toString() || 'ユーザー一覧の取得中にエラーが発生しました'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        success: false
      },
      { status: 400 }
    )
  }
}


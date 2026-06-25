import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'メールアドレスが必要です' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'サーバー設定エラー: 環境変数が不足しています' },
        { status: 500 }
      )
    }

    // Use admin client with service role key to bypass RLS on user_emails
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data, error } = await supabaseAdmin
      .from('user_emails')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.error('Email check error:', error)
      return NextResponse.json({ error: '検索処理中にエラーが発生しました' }, { status: 500 })
    }

    return NextResponse.json({ exists: !!data })
  } catch (error: any) {
    console.error('Unexpected error in email check:', error)
    return NextResponse.json({ error: '予期せぬエラーが発生しました' }, { status: 500 })
  }
}

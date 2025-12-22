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
    let { email, password, displayName, role, groupName, strategy } = body

    // バリデーション
    if (!password || !displayName) {
      return NextResponse.json(
        { error: 'パスワードと表示名は必須です' },
        { status: 400 }
      )
    }

    // UUID生成用
    const { v4: uuidv4 } = require('uuid')

    // メールアドレスがない場合はダミーを生成
    if (!email) {
      email = `no-email-${uuidv4()}@ig-nazuna-fes.com`
    }

    // 2. 重複チェック (メール OR 名前)
    // メール重複チェック
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) console.error('Error listing users:', listError)

    // 全ユーザー取得ループ (前回の修正と同様)
    let allAuthUsers: any[] = []
    let page = 1
    const perPage = 50
    let hasMore = true
    while (hasMore) {
      const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: page, perPage: perPage })
      if (authError) break;
      const users = data.users || []
      allAuthUsers = [...allAuthUsers, ...users]
      if (users.length < perPage) hasMore = false; else page++;
    }

    let duplicateUser = allAuthUsers.find(u => u.email === email)

    // 名前重複チェック (メールで重複が見つかっていない場合)
    if (!duplicateUser) {
      const { data: nameMatch } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('display_name', displayName)
        .single()

      if (nameMatch) {
        // プロフィールからIDを取得し、Authユーザーを特定
        duplicateUser = allAuthUsers.find(u => u.id === nameMatch.id)
      }
    }

    if (duplicateUser) {
      // 重複が見つかった場合の処理
      if (!strategy) {
        return NextResponse.json(
          { error: 'ユーザーが既に存在します', duplicate: true, existingUser: { email: duplicateUser.email, displayName } },
          { status: 409 }
        )
      }

      if (strategy === 'replace') {
        // 既存ユーザーを更新
        const userId = duplicateUser.id
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            display_name: displayName,
            role: role || 'staff',
            group_name: groupName // グループも更新
          })
          .eq('id', userId)

        if (updateError) throw updateError

        return NextResponse.json({
          success: true,
          message: '既存ユーザー情報を更新しました'
        }, { status: 200 })

      } else if (strategy === 'keep_both') {
        // 両方残す -> 新規作成 (メール重複ならダミーメール化)
        if (duplicateUser.email === email) {
          // メールが被っている場合はダミー化して新規作成
          email = `no-email-${uuidv4()}@ig-nazuna-fes.com`
        }
        // そのまま下部の新規作成フローへ進む
      }
    }

    // --- 以下、新規作成フロー (以前と同じ) ---

    // 新規ユーザーを作成（user_metadataにdisplay_nameを設定）
    const { data: newAuthData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        full_name: displayName
      }
    })

    if (authError) {
      // 万が一ここで重複エラーが出た場合
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に登録されています' },
          { status: 409 }
        )
      }
      throw authError
    }

    if (!newAuthData.user) {
      throw new Error('ユーザー作成に失敗しました')
    }

    const userId = newAuthData.user.id

    // プロフィール情報を作成
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          display_name: displayName,
          role: role || 'staff',
          group_name: groupName || null
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false
        }
      )

    if (profileError) {
      console.error('Profile upsert error:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw profileError
    }

    return NextResponse.json({
      success: true,
      user: newAuthData.user,
      message: 'ユーザーを作成しました'
    }, { status: 200 })

  } catch (error: any) {
    console.error('Create user error:', error)
    const errorMessage = error?.message || error?.toString() || 'ユーザー作成中にエラーが発生しました'

    return NextResponse.json(
      {
        error: errorMessage,
        success: false
      },
      { status: 400 }
    )
  }
}


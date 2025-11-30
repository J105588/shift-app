import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // 1. 特権モードでSupabaseに接続
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const body = await request.json()
    const { email, password, displayName, role } = body

    // バリデーション
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'メールアドレス、パスワード、表示名は必須です' },
        { status: 400 }
      )
    }

    // 2. 既存ユーザーをチェック
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(u => u.email === email)

    let authData: any
    let userId: string

    if (existingUser) {
      // 既存ユーザーの場合
      userId = existingUser.id
      
      // プロフィールが既に存在するかチェック
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (existingProfile) {
        // プロフィールが存在する場合は更新
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            display_name: displayName,
            role: role || 'staff'
          })
          .eq('id', userId)

        if (updateError) throw updateError

        return NextResponse.json({
          success: true,
          user: existingUser,
          message: '既存ユーザーのプロフィールを更新しました'
        })
      } else {
        // プロフィールが存在しない場合は作成
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert([
            {
              id: userId,
              display_name: displayName,
              role: role || 'staff'
            }
          ])

        if (profileError) throw profileError

        return NextResponse.json({
          success: true,
          user: existingUser,
          message: '既存ユーザーにプロフィールを追加しました'
        })
      }
    } else {
      // 新規ユーザーを作成
      const { data: newAuthData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      if (authError) {
        // メールアドレスが既に使用されている場合のエラーハンドリング
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

      userId = newAuthData.user.id

      // 3. プロフィール情報を作成（upsertを使用して安全に作成）
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: userId,
            display_name: displayName,
            role: role || 'staff'
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false
          }
        )

      if (profileError) {
        // プロフィール作成に失敗した場合、作成したauthユーザーを削除
        await supabaseAdmin.auth.admin.deleteUser(userId)
        throw profileError
      }

      return NextResponse.json({
        success: true,
        user: newAuthData.user,
        message: 'ユーザーを作成しました'
      })
    }

  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: error.message || 'ユーザー作成中にエラーが発生しました' },
      { status: 400 }
    )
  }
}

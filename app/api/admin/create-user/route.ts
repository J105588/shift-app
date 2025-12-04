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
    const { email, password, displayName, role } = body

    // バリデーション
    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'メールアドレス、パスワード、表示名は必須です' },
        { status: 400 }
      )
    }

    // 2. 既存ユーザーをチェック
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      // リスト取得に失敗しても続行（新規ユーザーとして処理）
    }
    
    const existingUser = existingUsers?.users?.find(u => u.email === email)

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

        if (updateError) {
          console.error('Profile update error:', updateError)
          throw updateError
        }

        return NextResponse.json({
          success: true,
          user: existingUser,
          message: '既存ユーザーのプロフィールを更新しました'
        }, { status: 200 })
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

        if (profileError) {
          console.error('Profile insert error:', profileError)
          throw profileError
        }

        return NextResponse.json({
          success: true,
          user: existingUser,
          message: '既存ユーザーにプロフィールを追加しました'
        }, { status: 200 })
      }
    } else {
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
      // トリガーで既に作成されている可能性があるため、upsertを使用
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: userId,
            display_name: displayName,  // 明示的にdisplay_nameを設定
            role: role || 'staff'
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false
          }
        )

      if (profileError) {
        console.error('Profile upsert error:', profileError)
        // プロフィール作成に失敗した場合、作成したauthユーザーを削除
        await supabaseAdmin.auth.admin.deleteUser(userId)
        throw profileError
      }

      // 4. プロフィールが正しく作成/更新されたことを確認
      const { data: createdProfile, error: verifyError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (verifyError || !createdProfile) {
        console.error('Profile verification error:', verifyError)
        throw new Error('プロフィールの作成を確認できませんでした')
      }

      // display_nameが正しく設定されているか確認
      if (createdProfile.display_name !== displayName) {
        console.warn('Display name mismatch. Expected:', displayName, 'Got:', createdProfile.display_name)
        // 再度更新を試みる
        const { error: retryError } = await supabaseAdmin
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', userId)
        
        if (retryError) {
          console.error('Retry update error:', retryError)
          throw new Error('display_nameの設定に失敗しました')
        }
      }

      return NextResponse.json({
        success: true,
        user: newAuthData.user,
        message: 'ユーザーを作成しました'
      }, { status: 200 })
    }

  } catch (error: any) {
    console.error('Create user error:', error)
    // エラーメッセージを安全に取得
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

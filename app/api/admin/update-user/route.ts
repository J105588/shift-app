import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
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
    const { userId, email, displayName, role, groupName } = body

    // バリデーション
    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDは必須です' },
        { status: 400 }
      )
    }

    // 2. ユーザーが存在するか確認
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (getUserError || !userData?.user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // 3. メールアドレスの更新（変更がある場合）
    if (email && email !== userData.user.email) {
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const emailExists = existingUsers?.users?.some(u => u.email === email && u.id !== userId)

      if (emailExists) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に使用されています' },
          { status: 409 }
        )
      }

      const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        user_metadata: {
          ...userData.user.user_metadata,
          display_name: displayName || userData.user.user_metadata?.display_name,
          full_name: displayName || userData.user.user_metadata?.full_name
        }
      })

      if (updateEmailError) {
        console.error('Email update error:', updateEmailError)
        return NextResponse.json(
          { error: 'メールアドレスの更新に失敗しました: ' + updateEmailError.message },
          { status: 400 }
        )
      }
    } else if (displayName && userData.user.user_metadata?.display_name !== displayName) {
      // メールアドレスは変更しないが、表示名のメタデータを更新
      const { error: updateMetadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...userData.user.user_metadata,
          display_name: displayName,
          full_name: displayName
        }
      })

      if (updateMetadataError) {
        console.error('Metadata update error:', updateMetadataError)
        // メタデータ更新の失敗は致命的ではないので続行
      }
    }

    // 4. プロフィール情報の更新
    const updateData: { display_name?: string; role?: string; group_name?: string } = {}

    if (displayName !== undefined) {
      updateData.display_name = displayName
    }

    if (groupName !== undefined) {
      updateData.group_name = groupName
    }

    if (role !== undefined) {
      // roleのバリデーション
      if (role !== 'admin' && role !== 'staff') {
        return NextResponse.json(
          { error: '権限は「admin」または「staff」である必要があります' },
          { status: 400 }
        )
      }
      updateData.role = role
    }

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
        return NextResponse.json(
          { error: 'プロフィールの更新に失敗しました: ' + profileError.message },
          { status: 400 }
        )
      }
    }

    // 5. 更新後のユーザー情報を取得
    const { data: updatedUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser?.user?.id,
        email: updatedUser?.user?.email,
        display_name: updatedProfile?.display_name,
        role: updatedProfile?.role,
        group_name: updatedProfile?.group_name
      },
      message: 'ユーザー情報を更新しました'
    }, { status: 200 })

  } catch (error: any) {
    console.error('Update user error:', error)
    const errorMessage = error?.message || error?.toString() || 'ユーザー更新中にエラーが発生しました'

    return NextResponse.json(
      {
        error: errorMessage,
        success: false
      },
      { status: 400 }
    )
  }
}


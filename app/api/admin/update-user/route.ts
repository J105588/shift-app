import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { verifyAdminRequest } from '@/lib/auth'

export async function PUT(request: Request) {
  // 管理者認証チェック
  const { error: authError, status: authStatus, requesterUser, role: requesterRole } = await verifyAdminRequest()
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
      const { data: existingEmail } = await supabaseAdmin
        .from('user_emails')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .maybeSingle()

      if (existingEmail) {
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

    // Requester Check for Super Admin Protection
    // ------------------------------------------------
    const isRequesterSuperAdmin = requesterRole === 'super_admin'

    // Get current target profile to check if they are Super Admin
    const { data: currentTargetProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // PROTECTION 1: Cannot modify a Super Admin unless you are a Super Admin
    if (currentTargetProfile?.role === 'super_admin' && !isRequesterSuperAdmin) {
      return NextResponse.json(
        { error: '権限エラー: Super Adminユーザーは変更できません' },
        { status: 403 }
      )
    }

    if (displayName !== undefined) {
      updateData.display_name = displayName
    }

    if (groupName !== undefined) {
      updateData.group_name = groupName
    }

    if (role !== undefined) {
      // roleのバリデーション
      const isTargetCurrentlySuperAdmin = currentTargetProfile?.role === 'super_admin'

      // PROTECTION 2: Cannot upgrade an existing non-super_admin user to Super Admin via API (DB only)
      if (role === 'super_admin' && !isTargetCurrentlySuperAdmin) {
        return NextResponse.json(
          { error: '権限エラー: Super Admin権限は画面からは付与できません' },
          { status: 403 }
        )
      }

      // PROTECTION 3: Super Admin cannot downgrade their own role
      const isSelfUpdate = userId === requesterUser?.id
      if (isTargetCurrentlySuperAdmin && isSelfUpdate && role !== 'super_admin') {
        return NextResponse.json(
          { error: '権限エラー: Super Adminは自身の権限を下げることはできません' },
          { status: 403 }
        )
      }

      if (role !== 'admin' && role !== 'staff' && role !== 'super_admin') {
        return NextResponse.json(
          { error: '権限は「admin」、「staff」、または「super_admin」である必要があります' },
          { status: 400 }
        )
      }

      // Systemグループの権限変更チェック(大文字小文字区別なし)
      // Super Adminはこれをバイパス可能
      if (!isRequesterSuperAdmin && currentTargetProfile?.group_name && currentTargetProfile.group_name.toLowerCase() === 'system') {
        return NextResponse.json(
          { error: 'Systemグループのユーザーの権限は変更できません' },
          { status: 403 }
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


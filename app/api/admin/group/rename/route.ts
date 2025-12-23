
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
            { error: 'サーバー設定エラー' },
            { status: 500 }
        )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check Requester Role
    const cookieStore = await cookies()
    const supabaseRequest = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    const { data: { user: requesterUser } } = await supabaseRequest.auth.getUser()
    let isRequesterSuperAdmin = false

    if (requesterUser) {
        const { data: requesterProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', requesterUser.id)
            .single()

        isRequesterSuperAdmin = requesterProfile?.role === 'super_admin'
    }

    try {
        const { oldGroupName, newGroupName, password } = await request.json()

        if (!oldGroupName || !newGroupName) {
            return NextResponse.json(
                { error: '古いグループ名と新しいグループ名は必須です' },
                { status: 400 }
            )
        }

        // 新しい名前がSystemの場合、パスワード認証が必要 (Super Adminは除外)
        if (newGroupName.toLowerCase() === 'system' && !isRequesterSuperAdmin) {
            const adminPassword = process.env.ADMIN_FORCE_LOGOUT_PASSWORD
            if (!adminPassword) {
                return NextResponse.json(
                    { error: 'サーバー設定エラー: 管理者パスワードが設定されていません' },
                    { status: 500 }
                )
            }
            if (password !== adminPassword) {
                return NextResponse.json(
                    { error: '管理者パスワードが間違っています' },
                    { status: 403 }
                )
            }
        }

        // Systemグループは名前変更不可 (Super Adminは除外)
        if (oldGroupName.toLowerCase() === 'system' && !isRequesterSuperAdmin) {
            return NextResponse.json(
                { error: 'Systemグループの名前は変更できません' },
                { status: 403 }
            )
        }

        const { error } = await supabaseAdmin
            .from('profiles')
            .update({ group_name: newGroupName })
            .eq('group_name', oldGroupName)

        if (error) {
            throw error
        }

        return NextResponse.json({
            success: true,
            message: `グループ名を「${oldGroupName}」から「${newGroupName}」に変更しました`
        })

    } catch (err: any) {
        console.error('Group rename error:', err)
        return NextResponse.json(
            { error: 'グループ名の変更に失敗しました' },
            { status: 500 }
        )
    }
}

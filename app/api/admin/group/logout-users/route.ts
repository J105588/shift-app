
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

    try {
        const { groupName } = await request.json()

        if (!groupName) {
            return NextResponse.json(
                { error: 'グループ名は必須です' },
                { status: 400 }
            )
        }

        // 1. グループに所属するユーザーのIDを取得
        const { data: profiles, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('group_name', groupName)

        if (fetchError) throw fetchError
        if (!profiles || profiles.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'ログアウト対象のユーザーはいませんでした'
            })
        }

        // 2. 各ユーザーをログアウトさせる（トークン無効化）
        const logoutPromises = profiles.map(profile =>
            supabaseAdmin.auth.admin.signOut(profile.id)
        )

        const results = await Promise.allSettled(logoutPromises)

        const failed = results.filter(r => r.status === 'rejected').length
        const success = results.length - failed

        return NextResponse.json({
            success: true,
            message: `${success}人のユーザーをログアウトさせました` + (failed > 0 ? `（${failed}人の処理に失敗）` : '')
        })

    } catch (err: any) {
        console.error('Group logout error:', err)
        return NextResponse.json(
            { error: '一括ログアウト処理に失敗しました' },
            { status: 500 }
        )
    }
}

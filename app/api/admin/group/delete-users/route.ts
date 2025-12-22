
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
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

        // Systemグループは削除不可
        if (groupName.toLowerCase() === 'system') {
            return NextResponse.json(
                { error: 'Systemグループのユーザーは一括削除できません' },
                { status: 403 }
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
                message: '削除対象のユーザーはいませんでした'
            })
        }

        // 2. Authユーザーを削除（これによりprofilesはCASCADEで削除されるはずだが、念のため）
        const deletePromises = profiles.map(profile =>
            supabaseAdmin.auth.admin.deleteUser(profile.id)
        )

        const results = await Promise.allSettled(deletePromises)

        const failed = results.filter(r => r.status === 'rejected').length
        const success = results.length - failed

        if (failed > 0) {
            return NextResponse.json({
                success: true,
                message: `${success}人のユーザーを削除しました（${failed}人の削除に失敗）`
            })
        }

        return NextResponse.json({
            success: true,
            message: `${success}人のユーザーを削除しました`
        })

    } catch (err: any) {
        console.error('Group delete error:', err)
        return NextResponse.json(
            { error: 'グループユーザーの削除に失敗しました' },
            { status: 500 }
        )
    }
}

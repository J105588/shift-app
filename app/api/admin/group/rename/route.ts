
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
        const { oldGroupName, newGroupName } = await request.json()

        if (!oldGroupName || !newGroupName) {
            return NextResponse.json(
                { error: '古いグループ名と新しいグループ名は必須です' },
                { status: 400 }
            )
        }

        // Systemグループは名前変更不可
        if (oldGroupName.toLowerCase() === 'system') {
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

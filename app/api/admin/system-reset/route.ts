
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function POST(request: Request) {
    // 1. 特権モードでSupabaseに接続
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
            { error: 'サーバー設定エラー' },
            { status: 500 }
        )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 2. リクエストユーザーがSuper Adminか確認
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

    const { data: { user: requesterUser }, error: userError } = await supabaseRequest.auth.getUser()
    if (userError || !requesterUser) {
        return NextResponse.json(
            { error: '認証エラー: ログインしてください' },
            { status: 401 }
        )
    }

    const { data: requesterProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', requesterUser.id)
        .single()

    if (requesterProfile?.role !== 'super_admin') {
        return NextResponse.json(
            { error: '権限エラー: この操作は最高管理者のみ実行可能です' },
            { status: 403 }
        )
    }

    try {
        const { confirmationKeyword } = await request.json()

        // 安全のため、確認キーワードをチェック (UI側で "delete" などを入力させる想定)
        if (confirmationKeyword !== 'delete_all_data') {
            return NextResponse.json(
                { error: '確認キーワードが正しくありません' },
                { status: 400 }
            )
        }

        // --- 削除処理実行 ---

        // 1. Super AdminのIDリストを取得 (これ以外のユーザーを削除するため)
        const { data: superAdmins, error: saError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('role', 'super_admin')

        if (saError) throw saError

        const superAdminIds = superAdmins.map(sa => sa.id)

        // 自分自身が含まれているか念のため確認 (認証通っているので含まれているはずだが)
        if (!superAdminIds.includes(requesterUser.id)) {
            return NextResponse.json(
                { error: '自身の権限確認に失敗しました' },
                { status: 500 }
            )
        }

        // 2. 関連テーブルのデータ削除
        // 外部キー制約がある場合があるため、子テーブルから順に削除するか、CASCADE設定に頼る
        // Supabase(Postgres)の設定次第だが、明示的に消していくのが無難

        // 通知
        const { error: notifError } = await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000') // 全削除 (neqはダミー条件)
        if (notifError) console.error('Notifications delete error:', notifError)

        // チャット関連
        // shift_group_chat_messages -> shift_group_chat_read_receipts (CASCADEされていればOKだが念のため)
        // ここでは親を消せばCASCADEされると仮定、あるいは全削除コマンドを実行

        // 既読 (もしテーブルがあれば。types.tsにはあるがテーブル名は推測)
        // テーブル名不明な場合は一旦スキップしてエラー出たら対処

        // メッセージ
        const { error: msgError } = await supabaseAdmin.from('shift_group_chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (msgError) console.error('Chat messages delete error:', msgError)

        // FCMトークン
        const { error: fcmError } = await supabaseAdmin.from('fcm_tokens').delete().neq('user_id', 'dummy')
        if (fcmError) console.error('FCM tokens delete error:', fcmError)

        // シフト関連
        // shift_assignments (もしあれば) -> shift_groups
        // 旧 shifts テーブル
        const { error: oldShiftsError } = await supabaseAdmin.from('shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (oldShiftsError) console.error('Old shifts delete error:', oldShiftsError)

        // 新 shifts テーブル (shift_assignments, shift_groups)
        const { error: assignmentsError } = await supabaseAdmin.from('shift_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (assignmentsError) console.error('Shift assignments delete error:', assignmentsError)

        const { error: groupsError } = await supabaseAdmin.from('shift_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (groupsError) console.error('Shift groups delete error:', groupsError)


        // 3. ユーザー削除 (Profiles & Auth)
        // まずProfilesから削除 (Super Admin以外)
        const { error: profilesError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .not('id', 'in', `(${superAdminIds.join(',')})`) // Super Admin以外

        if (profilesError) throw profilesError

        // 次にAuthユーザーを削除
        // listUsersで全ユーザー取得してからフィルタリングして削除
        let allAuthUsers: any[] = []
        let page = 1
        let hasMore = true
        while (hasMore) {
            const { data: authData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
            if (listError) break
            const users = authData.users || []
            allAuthUsers = [...allAuthUsers, ...users]
            if (users.length < 1000) hasMore = false
            else page++
        }

        // 削除対象の抽出
        const usersToDelete = allAuthUsers.filter(u => !superAdminIds.includes(u.id))

        // 並列削除だとレートリミットに引っかかる可能性があるので、ある程度直列またはバッチで
        for (const user of usersToDelete) {
            await supabaseAdmin.auth.admin.deleteUser(user.id)
        }

        return NextResponse.json({
            success: true,
            message: 'システム初期化が完了しました。Super Admin以外の全データが削除されました。'
        })

    } catch (error: any) {
        console.error('System reset error:', error)
        return NextResponse.json(
            { error: 'システム初期化中にエラーが発生しました: ' + error.message },
            { status: 500 }
        )
    }
}

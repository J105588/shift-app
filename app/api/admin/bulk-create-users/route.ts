import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 60 // タイムアウトを延長

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
        const { users } = body // users: Array<{ email, password, displayName, role, groupName }>

        if (!users || !Array.isArray(users) || users.length === 0) {
            return NextResponse.json(
                { error: 'ユーザーリストが無効です' },
                { status: 400 }
            )
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        }

        // 2. 既存ユーザーを一括取得（チェック用）
        const { data: existingUsersData } = await supabaseAdmin.auth.admin.listUsers()
        const existingEmails = new Set(existingUsersData?.users.map(u => u.email) || [])

        // 3. ループ処理（並列処理しすぎるとレート制限にかかる可能性があるため、一旦直列に近い形で実装推奨だが、Promise.allSettledで並列化）
        // 大量データの場合はチャンク分割が必要だが、今回は小規模（<100）と想定

        const processUser = async (user: any) => {
            const { email, password, displayName, role, groupName } = user

            if (!email || !password || !displayName) {
                throw new Error(`${email || '不明なメール'}: 必須項目が不足しています`)
            }

            // 既存チェック
            if (existingEmails.has(email)) {
                // 既存ユーザーの場合はグループ名などを更新するロジックを入れても良いが、
                // 今回は「登録」なので、既存ならスキップまたは更新とする。
                // ここでは既存ユーザーのグループ名更新を行うことにする。
                const existingUser = existingUsersData?.users.find(u => u.email === email)
                if (existingUser) {
                    const { error: updateError } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            display_name: displayName,
                            role: role || 'staff',
                            group_name: groupName || null
                        })
                        .eq('id', existingUser.id)

                    if (updateError) throw updateError;
                    return 'updated';
                }
            }

            // 新規作成
            const { data: newAuthData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    display_name: displayName,
                    full_name: displayName
                }
            })

            if (authError) throw authError
            if (!newAuthData.user) throw new Error(`${email}: ユーザー作成に失敗しました`)

            const userId = newAuthData.user.id

            // プロフィール作成
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: userId,
                    display_name: displayName,
                    role: role || 'staff',
                    group_name: groupName || null
                })

            if (profileError) {
                // プロフィール作成失敗時はAuthユーザーも消す（ロールバック的処理）
                await supabaseAdmin.auth.admin.deleteUser(userId)
                throw profileError
            }

            return 'created'
        }

        // Promise.allSettled で実行
        const promises = users.map(user =>
            processUser(user)
                .then(() => ({ status: 'fulfilled' }))
                .catch(err => ({ status: 'rejected', reason: err.message || JSON.stringify(err) }))
        )

        const outcomes = await Promise.allSettled(promises)

        outcomes.forEach((outcome) => {
            // @ts-ignore
            if (outcome.value && outcome.value.status === 'fulfilled') {
                results.success++
            } else if (outcome.status === 'rejected') {
                results.failed++
                results.errors.push(outcome.reason as string)
            }
        })

        return NextResponse.json({
            success: true,
            results,
            message: `${results.success}人のユーザーを処理しました（失敗: ${results.failed}人）`
        }, { status: 200 })

    } catch (error: any) {
        console.error('Bulk create error:', error)
        return NextResponse.json(
            { error: '一括登録中にサーバーエラーが発生しました' },
            { status: 500 }
        )
    }
}

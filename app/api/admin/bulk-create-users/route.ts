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
        const { users, strategy } = body // strategy: 'replace' | 'keep_both' | undefined

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

        // 2. 既存ユーザーを一括取得（全件取得）
        let allAuthUsers: any[] = []
        let page = 1
        const perPage = 50
        let hasMore = true
        while (hasMore) {
            const { data, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: page, perPage: perPage })
            if (authError) {
                console.error('Error listing auth users:', authError)
                break;
            }
            const us = data.users || []
            allAuthUsers = [...allAuthUsers, ...us]
            if (us.length < perPage) hasMore = false; else page++;
        }

        // 全プロフィール取得
        const { data: allProfiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('*')

        if (profilesError) console.error('Error fetching profiles:', profilesError)

        const existingEmails = new Set(allAuthUsers.map(u => u.email))
        const existingNames = new Map(allProfiles?.map((p: any) => [p.display_name, p.id]))
        const { v4: uuidv4 } = require('uuid')

        // 3. ループ処理
        const processUser = async (user: any) => {
            let { email, password, displayName, role, groupName } = user

            if (!password || !displayName) {
                throw new Error(`${email || displayName}: パスワードと表示名は必須です`)
            }

            if (!email) {
                email = `no-email-${uuidv4()}@ig-nazuna-fes.com`
            }

            // 重複チェック
            let duplicateUserId: string | null = null
            let isEmailConflict = false

            // メール重複
            const existingAuthUser = allAuthUsers.find(u => u.email === email)
            if (existingAuthUser) {
                duplicateUserId = existingAuthUser.id
                isEmailConflict = true
            } else {
                // 名前重複
                if (existingNames.has(displayName)) {
                    duplicateUserId = existingNames.get(displayName) || null
                }
            }

            if (duplicateUserId) {
                // 重複時の処理
                if (!strategy) {
                    throw new Error(`${displayName} (${email}): ユーザーが既に存在します`)
                }

                if (strategy === 'replace') {
                    // 更新処理
                    const { error: updateError } = await supabaseAdmin
                        .from('profiles')
                        .update({
                            display_name: displayName,
                            role: role || 'staff',
                            group_name: groupName || null
                        })
                        .eq('id', duplicateUserId)

                    if (updateError) throw updateError
                    return 'updated'

                } else if (strategy === 'keep_both') {
                    // 新規作成（メール重複ならダミー化）
                    if (isEmailConflict) {
                        email = `no-email-${uuidv4()}@ig-nazuna-fes.com`
                    }
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
                await supabaseAdmin.auth.admin.deleteUser(userId)
                throw profileError
            }

            return 'created'
        }

        // Promise.allSettled で実行
        // 並列数を制限したほうが安全だが、今回はマップで実行
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

import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  // クライアントサイドでのみ実行されることを確認
  if (typeof window === 'undefined') {
    // サーバーサイドではダミークライアントを返す（実際には使用されない）
    // ビルド時のプリレンダリングエラーを防ぐため
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file.'
    )
  }

  return createBrowserClient(url, key)
}
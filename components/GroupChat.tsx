'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { format } from 'date-fns/format'
import { ja } from 'date-fns/locale/ja'
import { Send, MessageCircle } from 'lucide-react'
import { ShiftGroupChatMessage } from '@/lib/types'

type ChatMessage = ShiftGroupChatMessage

type Props = {
  shiftGroupId: string
  currentUserId: string
  shiftEndTime: Date
  shiftTitle: string
  shiftStartTime: Date
}

export default function GroupChat({
  shiftGroupId,
  currentUserId,
  shiftEndTime,
  shiftTitle,
  shiftStartTime
}: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [canChat, setCanChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // チャットが利用可能かチェック（シフト終了後30分まで）
  const checkChatAvailability = () => {
    const now = new Date()
    const chatEndTime = new Date(shiftEndTime.getTime() + 30 * 60 * 1000) // 30分後
    const isAvailable = now <= chatEndTime
    setCanChat(isAvailable)
    return isAvailable
  }

  // メッセージを取得
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_group_chat_messages')
        .select('*, profiles!shift_group_chat_messages_user_id_fkey(id, display_name)')
        .eq('shift_group_id', shiftGroupId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('メッセージ取得エラー:', error)
        return
      }

      if (data) {
        setMessages(data as ChatMessage[])
      }
    } catch (error) {
      console.error('メッセージ取得エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // メッセージ送信
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || isSending || !canChat) return

    setIsSending(true)
    try {
      // チャット利用可能か再チェック
      if (!checkChatAvailability()) {
        alert('チャット機能はシフト終了後30分まで利用できます')
        setIsSending(false)
        return
      }

      const { error } = await supabase
        .from('shift_group_chat_messages')
        .insert({
          shift_group_id: shiftGroupId,
          user_id: currentUserId,
          message: newMessage.trim()
        })

      if (error) {
        console.error('メッセージ送信エラー:', error)
        alert('メッセージの送信に失敗しました')
        setIsSending(false)
        return
      }

      // 通知を送信（参加者全員に、送信者以外）
      await sendChatNotification(newMessage.trim())

      setNewMessage('')
    } catch (error) {
      console.error('メッセージ送信エラー:', error)
      alert('メッセージの送信に失敗しました')
    } finally {
      setIsSending(false)
    }
  }

  // チャット通知を送信
  const sendChatNotification = async (messageContent: string) => {
    try {
      // 送信者の情報を取得
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', currentUserId)
        .single()

      const senderName = senderProfile?.display_name || '不明'

      // シフトグループの参加者を取得
      const { data: assignments } = await supabase
        .from('shift_assignments')
        .select('user_id')
        .eq('shift_group_id', shiftGroupId)

      if (!assignments) return

      // 送信者以外の参加者に通知を送信
      const targetUserIds = assignments
        .map(a => a.user_id)
        .filter(id => id !== currentUserId)

      if (targetUserIds.length === 0) return

      // シフト時間のフォーマット
      const timeFormat = format(shiftStartTime, 'M/d HH:mm', { locale: ja }) + '〜' + format(shiftEndTime, 'HH:mm', { locale: ja })

      // 通知タイトルと本文を作成
      const notificationTitle = `${timeFormat}、${shiftTitle}`
      const notificationBody = `${senderName}：${messageContent}`

      // 通知を作成（即時送信）
      const nowIso = new Date().toISOString()
      const payloads = targetUserIds.map((userId) => ({
        target_user_id: userId,
        title: notificationTitle,
        body: notificationBody,
        scheduled_at: nowIso
      }))

      const { error } = await supabase.from('notifications').insert(payloads)
      
      if (error) {
        console.error('通知作成エラー:', error)
      }
    } catch (error) {
      console.error('通知送信エラー:', error)
    }
  }

  // 初期化とリアルタイム購読
  useEffect(() => {
    if (!shiftGroupId) return

    checkChatAvailability()
    fetchMessages()

    // リアルタイム購読
    const channel = supabase
      .channel(`shift_group_chat_${shiftGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_group_chat_messages',
          filter: `shift_group_id=eq.${shiftGroupId}`
        },
        () => {
          fetchMessages()
        }
      )
      .subscribe()

    // 定期的にチャット利用可能かチェック（1分ごと）
    const availabilityInterval = setInterval(() => {
      checkChatAvailability()
    }, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(availabilityInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftGroupId])

  // メッセージが更新されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // チャット利用可能時間を計算
  const getChatEndTime = () => {
    const chatEndTime = new Date(shiftEndTime.getTime() + 30 * 60 * 1000)
    return format(chatEndTime, 'M/d HH:mm', { locale: ja })
  }

  if (isLoading) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-white" size={18} />
          <h3 className="text-white font-semibold text-sm">グループチャット</h3>
        </div>
        {!canChat && (
          <span className="text-xs text-white/90 bg-white/20 px-2 py-1 rounded">
            利用期限切れ
          </span>
        )}
      </div>

      {/* チャット利用可能時間の表示 */}
      {canChat && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-xs text-blue-700">
            チャットは {getChatEndTime()} まで利用できます
          </p>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div
        ref={chatContainerRef}
        className="h-64 overflow-y-auto p-4 space-y-3 bg-white"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            まだメッセージがありません
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === currentUserId
            const senderName = msg.profiles?.display_name || '不明'
            const messageTime = format(new Date(msg.created_at), 'HH:mm', { locale: ja })

            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {!isOwnMessage && (
                    <div className="text-xs font-semibold mb-1 opacity-90">
                      {senderName}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.message}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-white/70' : 'text-slate-500'
                    }`}
                  >
                    {messageTime}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* メッセージ入力 */}
      {canChat ? (
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="メッセージを入力..."
              className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
              disabled={isSending}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {newMessage.length}/500文字
          </p>
        </form>
      ) : (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600 text-center">
            チャット機能はシフト終了後30分まで利用できます
          </p>
        </div>
      )}
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'

export type ToastMessage = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timestamp: number
  actionLabel?: string
  onAction?: () => void
}

type Props = {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

export default function NotificationToast({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`
            rounded-lg shadow-lg border p-4 animate-in slide-in-from-right
            ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : ''}
            ${msg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : ''}
            ${msg.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : ''}
            ${msg.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
          `}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {msg.type === 'success' && (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {msg.type === 'error' && (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {msg.type === 'warning' && (
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                {msg.type === 'info' && (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="font-semibold text-sm">
                  {msg.type === 'success' && '成功'}
                  {msg.type === 'error' && 'エラー'}
                  {msg.type === 'warning' && '警告'}
                  {msg.type === 'info' && '情報'}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
              {msg.actionLabel && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      msg.onAction?.()
                      onDismiss(msg.id)
                    }}
                    className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-white/90 text-slate-800 hover:bg-white transition-colors"
                  >
                    {msg.actionLabel}
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => onDismiss(msg.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}


'use client'
import { Clock, Users, UserCog, X, CalendarDays } from 'lucide-react'

type ShiftDetail = {
  id: string
  title: string
  start: Date
  end: Date
  description?: string | null
}

type Coworker = {
  id: string
  displayName: string
  isCurrentUser: boolean
}

type Props = {
  isOpen: boolean
  onClose: () => void
  shift: ShiftDetail | null
  coworkers: Coworker[]
  supervisorName?: string | null
}

export default function ShiftDetailModal({ isOpen, onClose, shift, coworkers, supervisorName }: Props) {
  if (!isOpen || !shift) return null

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (date: Date) =>
    date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-blue-600 px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="text-white" size={20} />
            <h2 className="text-white font-bold text-base sm:text-lg">
              シフト詳細
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-colors duration-200"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* 時間・タイトル */}
          <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock size={20} className="text-blue-700" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-600 mb-1">
                  {formatDate(shift.start)}
                </div>
                <div className="font-bold text-slate-900 text-base sm:text-lg">
                  {formatTime(shift.start)} 〜 {formatTime(shift.end)}
                </div>
                <div className="mt-2 text-sm font-semibold text-blue-900">
                  {shift.title}
                </div>
              </div>
            </div>
          </div>

          {/* 仕事内容メモ */}
          {shift.description && (
            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
              <div className="text-xs font-semibold text-slate-600 mb-1">
                仕事内容のメモ
              </div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {shift.description}
              </p>
            </div>
          )}

          {/* 統括 */}
          {supervisorName && (
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <UserCog size={16} className="text-blue-700" />
                <span className="text-xs font-semibold text-blue-700">
                  統括
                </span>
              </div>
              <div className="text-sm font-semibold text-blue-900">
                {supervisorName}
              </div>
            </div>
          )}

          {/* 一緒のシフトのメンバー */}
          {coworkers.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-slate-700" />
                <span className="text-xs font-semibold text-slate-700">
                  一緒のシフトのメンバー
                </span>
              </div>
              <div className="space-y-1.5">
                {coworkers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-900">{c.displayName}</span>
                    {c.isCurrentUser && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">
                        あなた
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



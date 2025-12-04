'use client'
import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday } from 'date-fns'
import { ja } from 'date-fns/locale/ja'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, UserCog } from 'lucide-react'
import { Profile, Shift } from '@/lib/types'

type ShiftWithProfile = Shift & {
  profiles?: Profile
  supervisor?: Profile
}

type Props = {
  shifts: ShiftWithProfile[]
  users: Profile[]
  onShiftClick?: (shift: ShiftWithProfile) => void
}

export default function SpreadsheetView({ shifts, users, onShiftClick }: Props) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // 週の開始日と終了日を計算
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }) // 月曜日開始
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // 各日のシフトを整理（ユーザーごと、日ごと）
  const shiftsByDayAndUser = useMemo(() => {
    const map = new Map<string, Map<string, ShiftWithProfile[]>>()
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd')
      const dayMap = new Map<string, ShiftWithProfile[]>()
      
      users.forEach(user => {
        const userShifts = shifts.filter(shift => 
          shift.user_id === user.id && 
          isSameDay(new Date(shift.start_time), day)
        )
        if (userShifts.length > 0) {
          dayMap.set(user.id, userShifts)
        }
      })
      
      map.set(dayKey, dayMap)
    })
    
    return map
  }, [shifts, users, weekDays])

  const handlePrevWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1))
  }

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1))
  }

  const handleToday = () => {
    setCurrentWeek(new Date())
  }

  const formatTime = (date: Date) => {
    return format(date, 'HH:mm', { locale: ja })
  }

  const formatDate = (date: Date) => {
    return format(date, 'M/d(E)', { locale: ja })
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* ヘッダーコントロール */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="text-blue-600" size={20} />
            表形式シフト表示
          </h3>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs sm:text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            今日
          </button>
        </div>

        {/* 週ナビゲーション */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevWeek}
            className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
            aria-label="前の週"
          >
            <ChevronLeft className="text-blue-600" size={20} />
          </button>
          <div className="text-center flex-1 px-4">
            <div className="text-sm sm:text-base font-semibold text-slate-900">
              {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(weekEnd, 'M月d日', { locale: ja })}
            </div>
          </div>
          <button
            onClick={handleNextWeek}
            className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
            aria-label="次の週"
          >
            <ChevronRight className="text-blue-600" size={20} />
          </button>
        </div>
      </div>

      {/* スプレッドシートテーブル */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="border border-slate-200 p-2 sm:p-3 text-left text-xs sm:text-sm font-semibold text-slate-700 min-w-[120px] sm:min-w-[150px]">
                ユーザー
              </th>
              {weekDays.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                const isDayToday = isToday(day)
                return (
                  <th
                    key={dayKey}
                    className={`border border-slate-200 p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold min-w-[140px] sm:min-w-[180px] ${
                      isDayToday ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    <div>{format(day, 'E', { locale: ja })}</div>
                    <div className={`text-base sm:text-lg font-bold ${isDayToday ? 'text-blue-700' : 'text-slate-900'}`}>
                      {format(day, 'd')}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="border border-slate-200 p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 sticky left-0 z-5">
                  {user.display_name}
                </td>
                {weekDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd')
                  const dayShifts = shiftsByDayAndUser.get(dayKey)?.get(user.id) || []
                  const isDayToday = isToday(day)
                  
                  return (
                    <td
                      key={dayKey}
                      className={`border border-slate-200 p-1 sm:p-2 align-top ${
                        isDayToday ? 'bg-blue-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        {dayShifts.length === 0 ? (
                          <div className="text-xs text-slate-400 text-center py-2">-</div>
                        ) : (
                          dayShifts.map((shift) => (
                            <div
                              key={shift.id}
                              onClick={() => onShiftClick?.(shift)}
                              className={`p-1.5 sm:p-2 rounded text-xs cursor-pointer transition-all hover:shadow-md ${
                                onShiftClick ? 'hover:scale-105' : ''
                              } bg-blue-100 border border-blue-200 hover:border-blue-400`}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <Clock size={10} className="text-blue-600" />
                                <span className="font-semibold text-blue-700">
                                  {formatTime(new Date(shift.start_time))} - {formatTime(new Date(shift.end_time))}
                                </span>
                              </div>
                              <div className="text-blue-900 font-medium mb-1">
                                {shift.title}
                              </div>
                              {shift.supervisor && (
                                <div className="flex items-center gap-1 text-blue-600">
                                  <UserCog size={10} />
                                  <span className="text-xs">
                                    {shift.supervisor.display_name}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div className="bg-slate-50 p-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
            <span>シフト</span>
          </div>
          <div className="flex items-center gap-2">
            <UserCog size={14} className="text-blue-600" />
            <span>統括者</span>
          </div>
        </div>
      </div>
    </div>
  )
}


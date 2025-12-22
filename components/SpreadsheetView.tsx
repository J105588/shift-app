'use client'
import { useState, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday } from 'date-fns'
import { ja } from 'date-fns/locale/ja'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, UserCog } from 'lucide-react'
import { Profile, Shift } from '@/lib/types'
import { getShiftColor, getTextColor, addOpacity } from '@/lib/colorUtils'

type ShiftWithProfile = Shift & {
  profiles?: Profile
  supervisor?: Profile
  isGroupShift?: boolean
  assignments?: any[]
  memberCount?: number
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
        const userShifts: ShiftWithProfile[] = []

        shifts.forEach(shift => {
          const shiftDate = new Date(shift.start_time)

          // 個別付与シフトの場合
          if (!shift.isGroupShift && shift.user_id === user.id && isSameDay(shiftDate, day)) {
            userShifts.push(shift)
          }
          // 団体付与シフトの場合
          else if (shift.isGroupShift && shift.assignments && isSameDay(shiftDate, day)) {
            // このユーザーが参加しているか確認
            const assignment = shift.assignments.find((a: any) => a.user_id === user.id)
            if (assignment) {
              // ユーザーごとのシフトとして表示するため、user_idを設定
              userShifts.push({
                ...shift,
                user_id: user.id,
                // 統括者情報を設定（既存のsupervisorがある場合はそれを使用、なければユーザーが統括者の場合はユーザー情報を使用）
                supervisor: shift.supervisor || (assignment.is_supervisor ? user : undefined)
              })
            }
          }
        })

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
          <div className="flex-1 px-2 text-center">
            <div className="text-sm sm:text-base font-semibold text-slate-900 whitespace-nowrap">
              {format(weekStart, 'M/d(E)', { locale: ja })} 〜 {format(weekEnd, 'M/d(E)', { locale: ja })}
            </div>
          </div>
          <button
            onClick={handleNextWeek}
            className="p-2 bg-white rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors flex-shrink-0"
            aria-label="次の週"
          >
            <ChevronRight className="text-blue-600" size={20} />
          </button>
        </div>
      </div>

      {/* スプレッドシートテーブル */}
      <div className="overflow-x-auto">
        <div className="min-w-full inline-block">
          <table className="w-full border-collapse min-w-[600px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="border border-slate-200 p-2 sm:p-3 text-left text-xs sm:text-sm font-semibold text-slate-700 min-w-[100px] sm:min-w-[120px] bg-slate-50 sticky left-0 z-20">
                  ユーザー
                </th>
                {weekDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd')
                  const isDayToday = isToday(day)
                  return (
                    <th
                      key={dayKey}
                      className={`border border-slate-200 p-2 sm:p-3 text-center text-xs sm:text-sm font-semibold min-w-[100px] sm:min-w-[140px] ${isDayToday ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                        }`}
                    >
                      <div className="text-[10px] sm:text-xs">{format(day, 'E', { locale: ja })}</div>
                      <div className={`text-sm sm:text-base font-bold ${isDayToday ? 'text-blue-700' : 'text-slate-900'}`}>
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
                  <td className="border border-slate-200 p-2 sm:p-3 text-xs sm:text-sm font-semibold text-slate-900 bg-slate-50 sticky left-0 z-10 whitespace-nowrap">
                    {user.display_name}
                  </td>
                  {weekDays.map((day) => {
                    const dayKey = format(day, 'yyyy-MM-dd')
                    const dayShifts = shiftsByDayAndUser.get(dayKey)?.get(user.id) || []
                    const isDayToday = isToday(day)

                    return (
                      <td
                        key={dayKey}
                        className={`border border-slate-200 p-1 sm:p-2 align-top ${isDayToday ? 'bg-blue-50/30' : 'bg-white'
                          }`}
                      >
                        <div className="space-y-1">
                          {dayShifts.length === 0 ? (
                            <div className="text-[10px] text-slate-400 text-center py-1 sm:py-2">-</div>
                          ) : (
                            dayShifts.map((shift) => {
                              const isGroupShift = shift.isGroupShift || false
                              const isSupervisor = shift.isGroupShift && shift.assignments?.find((a: any) => a.user_id === user.id && a.is_supervisor)
                              const shiftColor = getShiftColor(shift)
                              const textColor = getTextColor(shiftColor)
                              const borderColor = shiftColor
                              const bgColor = addOpacity(shiftColor, 0.2) // 20% opacity

                              return (
                                <div
                                  key={shift.id}
                                  onClick={() => onShiftClick?.(shift)}
                                  className={`p-1 sm:p-1.5 rounded text-[10px] sm:text-xs cursor-pointer transition-all ${onShiftClick ? 'hover:shadow-md active:scale-95' : ''
                                    }`}
                                  style={{
                                    backgroundColor: bgColor,
                                    borderColor: borderColor,
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                  }}
                                >
                                  <div className="flex items-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1 flex-wrap">
                                    <Clock size={9} style={{ color: borderColor }} className="flex-shrink-0" />
                                    <span className="font-semibold leading-tight" style={{ color: textColor }}>
                                      {formatTime(new Date(shift.start_time))}-{formatTime(new Date(shift.end_time))}
                                    </span>
                                  </div>
                                  <div className="font-medium mb-0.5 sm:mb-1 leading-tight" style={{ color: textColor }}>
                                    {shift.title}
                                    {isGroupShift && shift.memberCount && shift.memberCount > 1 && (
                                      <span className="text-[9px] ml-1 opacity-80">({shift.memberCount}名)</span>
                                    )}
                                  </div>
                                  {isSupervisor && (
                                    <div className="flex items-center gap-0.5 sm:gap-1" style={{ color: borderColor }}>
                                      <UserCog size={9} />
                                      <span className="text-[9px] sm:text-xs">統括</span>
                                    </div>
                                  )}
                                  {!isGroupShift && shift.supervisor && (
                                    <div className="flex items-center gap-0.5 sm:gap-1" style={{ color: borderColor }}>
                                      <UserCog size={9} />
                                      <span className="text-[9px] sm:text-xs">
                                        {shift.supervisor.display_name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            })
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
      </div>

      {/* 凡例 */}
      <div className="bg-slate-50 p-2 sm:p-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-600">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-100 border border-blue-200 rounded"></div>
            <span>個別シフト</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 bg-purple-100 border border-purple-200 rounded"></div>
            <span>団体シフト</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <UserCog size={12} className="text-blue-600" />
            <span>統括者</span>
          </div>
        </div>
      </div>
    </div>
  )
}


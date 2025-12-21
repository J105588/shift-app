'use client'

import { useState } from 'react'
import { importShifts } from '@/app/actions/importShifts'
import { Upload, AlertCircle, CheckCircle, Calendar as CalendarIcon, Loader2 } from 'lucide-react'

export default function ShiftImportComponent() {
    // Default to tomorrow for convenience, or today
    const today = new Date().toISOString().split('T')[0]
    const [date, setDate] = useState<string>(today)
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean, count?: number, errors?: string[] | null } | null>(null)

    const handleImport = async () => {
        if (!date) return

        if (!confirm(`${date}のシフトとして自動振り分けを実行しますか？\n(注意: 同じユーザー・時間のシフトが重複して登録される可能性があります)`)) {
            return
        }

        setIsLoading(true)
        setResult(null)
        try {
            const res = await importShifts(date)
            setResult(res)
        } catch (e) {
            console.error(e)
            setResult({ success: false, errors: ['予期せぬエラーが発生しました'] })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto mt-6">
            <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Upload size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900">シフト自動振り分け</h2>
                    <p className="text-sm text-slate-500">外部データソースからシフトを取得して登録します</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        対象日付（この日付のデータとして登録されます）
                    </label>
                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1 max-w-xs">
                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="pl-10 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 border px-3"
                            />
                        </div>
                        <button
                            onClick={handleImport}
                            disabled={isLoading || !date}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    処理中...
                                </>
                            ) : (
                                <>
                                    <Upload size={18} />
                                    データを取得して登録
                                </>
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        ※ 元のJSONデータには日付情報が含まれていないため、ここで指定した日付として処理されます。<br />
                        ※ ユーザー名は完全一致で判定されます。一致しない場合はエラーとして表示されます。
                    </p>
                </div>

                {result && (
                    <div className={`rounded-lg p-4 border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {result.success ? (
                                <CheckCircle className="text-green-600" size={20} />
                            ) : (
                                <AlertCircle className="text-red-600" size={20} />
                            )}
                            <h3 className={`font-bold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                                {result.success ? '処理が完了しました' : 'エラーが発生しました'}
                            </h3>
                        </div>

                        {result.count !== undefined && (
                            <p className="text-green-700 ml-7 mb-2">
                                <span className="font-bold text-lg">{result.count}</span> 件のシフトを登録しました。
                            </p>
                        )}

                        {result.errors && result.errors.length > 0 && (
                            <div className="mt-3 ml-7 bg-white/50 rounded p-3 border border-red-100">
                                <p className="text-red-800 font-semibold text-sm mb-1">以下のエラーを確認してください:</p>
                                <ul className="list-disc list-inside text-sm text-red-700 space-y-1 max-h-60 overflow-y-auto">
                                    {result.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

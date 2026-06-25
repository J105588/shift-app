'use client'
import { useState, useEffect } from 'react'
import { registerAlertHandler } from '@/lib/alert'
import { AlertCircle, HelpCircle } from 'lucide-react'

export default function AlertProvider() {
  const [config, setConfig] = useState<{
    message: string;
    type: 'alert' | 'confirm';
    resolve: (value: boolean) => void;
  } | null>(null);

  useEffect(() => {
    registerAlertHandler(setConfig);
    return () => registerAlertHandler(null);
  }, []);

  if (!config) return null;

  const handleClose = (result: boolean) => {
    config.resolve(result);
    setConfig(null);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => {
        // alertの場合はモーダル外クリックでも閉じられる（確定扱い）
        if (config.type === 'alert') {
          handleClose(true);
        }
      }}
    >
      <div 
        className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xl shadow-slate-900/12 max-w-md w-full animate-in zoom-in-95 duration-200 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-4 items-start">
          <div className={`p-3 rounded-xl flex-shrink-0 ${
            config.type === 'alert' 
              ? 'bg-amber-50 text-amber-600' 
              : 'bg-blue-50 text-blue-600'
          }`}>
            {config.type === 'alert' ? <AlertCircle size={24} /> : <HelpCircle size={24} />}
          </div>
          
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-900 leading-6">
              {config.type === 'alert' ? 'メッセージ' : '確認'}
            </h3>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
              {config.message}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
          {config.type === 'confirm' && (
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer min-w-[80px]"
            >
              キャンセル
            </button>
          )}
          <button
            type="button"
            onClick={() => handleClose(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-md shadow-blue-600/10 min-w-[80px]"
          >
            {config.type === 'alert' ? '閉じる' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

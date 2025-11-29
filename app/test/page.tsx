'use client'

/**
 * Tailwind CSS適用確認用テストページ
 * このページでTailwindクラスが正しく適用されているか確認できます
 */
export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Tailwind CSS 適用確認ページ
        </h1>

        {/* カラーテスト */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">1. カラーテスト</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-indigo-500 text-white p-4 rounded-lg text-center font-semibold">
              Indigo
            </div>
            <div className="bg-purple-500 text-white p-4 rounded-lg text-center font-semibold">
              Purple
            </div>
            <div className="bg-pink-500 text-white p-4 rounded-lg text-center font-semibold">
              Pink
            </div>
          </div>
        </div>

        {/* グラデーションテスト */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">2. グラデーションテスト</h2>
          <div className="h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl"></div>
        </div>

        {/* 影・ボーダーラディウステスト */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">3. 影・角丸テスト</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-100 p-4 rounded-lg shadow-sm">shadow-sm</div>
            <div className="bg-blue-100 p-4 rounded-xl shadow-md">shadow-md</div>
            <div className="bg-blue-100 p-4 rounded-2xl shadow-xl">shadow-xl</div>
          </div>
        </div>

        {/* レスポンシブテスト */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">4. レスポンシブテスト</h2>
          <div className="bg-green-100 p-4 rounded-lg text-center">
            <span className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold">
              画面サイズに応じて文字サイズが変わります
            </span>
          </div>
        </div>

        {/* ガラスモーフィズムテスト */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">5. ガラスモーフィズムテスト</h2>
          <p className="text-gray-600">
            このカードは半透明の背景とぼかし効果（backdrop-blur）を使用しています
          </p>
        </div>

        {/* ボタンテスト */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">6. ボタンテスト</h2>
          <div className="flex gap-4 flex-wrap">
            <button className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
              ホバーエフェクト
            </button>
            <button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg">
              グラデーションボタン
            </button>
            <button className="border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors">
              アウトラインボタン
            </button>
          </div>
        </div>

        {/* 確認結果 */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-green-500">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">✅ 確認項目</h2>
          <ul className="space-y-2 text-gray-700">
            <li>✓ カラーが正しく表示されている</li>
            <li>✓ グラデーションが適用されている</li>
            <li>✓ 影と角丸が適用されている</li>
            <li>✓ ホバー時に色が変わる</li>
            <li>✓ ガラスモーフィズム効果が見える</li>
            <li>✓ レスポンシブに反応する（画面サイズを変更）</li>
          </ul>
          <p className="mt-4 p-4 bg-green-50 rounded-lg text-green-800 font-semibold">
            👆 すべての項目が確認できれば、Tailwind CSSは正しく適用されています！
          </p>
        </div>
      </div>
    </div>
  )
}


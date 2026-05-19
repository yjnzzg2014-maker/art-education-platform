import { useEffect, useState } from 'react'
import client from '../api/client'

export default function AISettingsModal({ onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    client.get('/settings').then(({ data }) => {
      setStatus(data)
    })
  }, [])

  const handleSave = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      const { data } = await client.put('/settings', { key: 'minimax_api_key', value: apiKey.trim() })
      setStatus(prev => ({ ...prev, minimax_api_key: { configured: true, masked: data.masked } }))
      setApiKey('')
    } catch {}
    setSaving(false)
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const { data } = await client.post('/settings/test-api')
      if (data.ok) {
        setStatus(prev => ({ ...prev, _testResult: data.message || '连接成功' }))
      } else {
        setStatus(prev => ({ ...prev, _testResult: data.error }))
      }
    } catch {
      setStatus(prev => ({ ...prev, _testResult: '请求失败' }))
    }
    setTesting(false)
  }

  const configured = status?.minimax_api_key?.configured || status?.env_minimax
  const testResult = status?._testResult

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-[480px] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">AI 分析配置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-700">MiniMax API Key</span>
              {configured ? (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">已配置</span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Mock 模式</span>
              )}
            </div>
            {status?.minimax_api_key?.configured && (
              <div className="text-xs text-gray-400 mb-2">当前: {status.minimax_api_key.masked}</div>
            )}
            {status?.env_minimax && !status?.minimax_api_key?.configured && (
              <div className="text-xs text-gray-400 mb-2">来源: 服务器环境变量</div>
            )}
            <p className="text-xs text-gray-500 mb-2">
              未配置时使用本地算法（基于像素色彩分析 + 规则评分）。
              填入 Key 后，AI 将通过视觉模型真正"看到"作品画面进行智能评分。
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="输入新的 API Key..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={!apiKey.trim() || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <button
                onClick={handleTest}
                disabled={testing || !configured}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              {testResult && (
                <span className={`text-xs max-w-[280px] truncate ${testResult.startsWith('连接成功') ? 'text-green-600' : 'text-red-500'}`}>
                  {testResult}
                </span>
              )}
            </div>
          </div>

          <div className="bg-gray-50 rounded p-3 text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-600 mb-1">说明</div>
            <div>1. Key 保存在服务器数据库中，优先级高于环境变量</div>
            <div>2. 保存后立即生效，AI 将真正观察画面内容进行评分</div>
            <div>3. 清空 Key 后将回退到纯本地算法模式</div>
            <div>4. API: MiniMax VLM 视觉理解接口</div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

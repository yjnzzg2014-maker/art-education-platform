import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useMaskStore } from '../stores/maskStore'
import { useNavigate } from 'react-router-dom'
import AISettingsModal from './AISettingsModal'

export default function Topbar() {
  const { user, logout } = useAuthStore()
  const masked = useMaskStore(s => s.masked)
  const toggle = useMaskStore(s => s.toggle)
  const navigate = useNavigate()
  const [showAISettings, setShowAISettings] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-5 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-white font-bold text-xs">智</div>
          <span className="font-semibold text-gray-800 text-sm">智绘 · 校园美育智能分析平台</span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {/* AI Settings */}
          <button onClick={() => setShowAISettings(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            AI 配置
          </button>

          {/* Mask toggle */}
          <button onClick={toggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${masked ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={masked
                ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              } />
            </svg>
            {masked ? '显示姓名' : '隐私模式'}
          </button>

          {/* Date */}
          <span className="text-gray-400 text-xs">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>

          {/* User */}
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {user?.name?.[0] || 'T'}
            </div>
            <span className="text-gray-700 text-sm">{user?.name || '教师'}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors text-xs ml-1">退出</button>
          </div>
        </div>
      </header>

      {showAISettings && <AISettingsModal onClose={() => setShowAISettings(false)} />}
    </>
  )
}

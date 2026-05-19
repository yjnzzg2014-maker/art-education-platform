import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const menuGroups = [
  {
    label: '工作台',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    ),
    items: [
      { label: '数据看板', to: '/reports', icon: '📊' },
      { label: '工作台', to: '/dashboard', icon: '🏠' }
    ]
  },
  {
    label: '作业分析',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    items: [
      { label: '批量作业分析', to: '/analysis', icon: '🎨' },
      { label: '单幅作品诊断', to: '/diagnosis', icon: '🔍' }
    ]
  },
  {
    label: '学生发展',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    items: [
      { label: '素养画像', to: '/students', icon: '👤' },
      { label: '纵向成长追踪', to: '/growth', icon: '📈' },
      { label: '异常发展预警', to: '/warning', icon: '⚠️' }
    ]
  },
  {
    label: '基础数据',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    items: [
      { label: '年级班级', to: '/classes', icon: '🏫' },
      { label: '用户管理', to: '/teachers', icon: '👥', adminOnly: true }
    ]
  },
  {
    label: '教研协同',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    items: [
      { label: '教研管理', to: '/research', icon: '📝' },
      { label: '释义记录', to: '/reviews', icon: '💬' }
    ]
  }
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const role = useAuthStore(s => s.user?.role)
  const isAdmin = role === 'admin'
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  const isActive = (path) => pathname === path || pathname.startsWith(path + '/')

  const toggleGroup = (label) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="h-12 flex items-center justify-center border-b border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        title={collapsed ? '展开菜单' : '收起菜单'}
      >
        <svg className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <nav className="flex-1 overflow-y-auto py-3">
        {menuGroups.map(group => {
          const isGroupCollapsed = collapsedGroups[group.label]
          const hasActiveItem = group.items.some(item => isActive(item.to))

          return (
            <div key={group.label} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium tracking-wider transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${hasActiveItem ? 'text-blue-600' : 'text-gray-400'} hover:text-gray-600`}
              >
                {collapsed ? (
                  <span className="w-5 h-5 flex items-center justify-center">{group.icon}</span>
                ) : (
                  <>
                    <span>{group.icon}</span>
                    <span className="flex-1 text-left">{group.label}</span>
                    <svg className={`w-3 h-3 transition-transform ${isGroupCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Group items */}
              {!collapsed && !isGroupCollapsed && (
                <div className="mt-0.5">
                  {group.items.filter(item => !item.adminOnly || isAdmin).map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 px-5 py-2.5 text-sm border-l-2 transition-colors ${
                        isActive(item.to)
                          ? 'border-blue-500 bg-blue-50 text-blue-600 font-medium'
                          : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="w-5 text-center text-xs">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Sidebar footer */}
      {!collapsed && (
        <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-400">
          智绘 · 美育智能平台
        </div>
      )}
    </aside>
  )
}

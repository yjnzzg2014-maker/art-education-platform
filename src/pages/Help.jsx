import { useState } from 'react'

const sections = [
  {
    id: 'quick-start',
    title: '快速开始',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</span>
            账号登录
          </h3>
          <div className="ml-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-500">管理员账号</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-gray-600">用户名：</span><span className="text-blue-600">admin</span>
            </div>
            <div className="font-mono text-sm">
              <span className="text-gray-600">密码：</span><span className="text-blue-600">admin123</span>
            </div>
            <p className="text-xs text-amber-600 mt-2">首次登录后请修改密码</p>
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">2</span>
            创建分析任务
          </h3>
          <div className="ml-8 space-y-3">
            {['点击「+ 新建分析任务」', '选择班级、输入主题名称', '上传学生作品图片', '发起 AI 分析'].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">{i + 1}</span>
                <span className="text-sm text-gray-600">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'modules',
    title: '功能模块',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    content: (
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: '数据看板', desc: '学校-年级-班级三级下钻统计', color: 'blue' },
          { name: '批量作业分析', desc: '四维评分、评级分布、色彩分布', color: 'green' },
          { name: '单幅作品诊断', desc: '详细分析、AI评语、历史趋势', color: 'purple' },
          { name: '学生素养画像', desc: '评级与历史作品一览', color: 'amber' },
          { name: '纵向成长追踪', desc: '分数变化趋势追踪', color: 'cyan' },
          { name: '多样化表达关注', desc: '关注独特作品、填写释义', color: 'rose' },
          { name: '教研管理', desc: '教研闭环、沉淀观察笔记', color: 'indigo' },
          { name: '释义记录', desc: '教师释义历史查看', color: 'teal' }
        ].map((item, i) => (
          <div key={i} className={`p-4 rounded-lg border border-gray-200 bg-${item.color}-50 hover:border-${item.color}-300 transition-colors`}>
            <h4 className="font-medium text-gray-800 mb-1">{item.name}</h4>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>
    )
  },
  {
    id: 'dimensions',
    title: '四维评分说明',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    content: (
      <div>
        <p className="text-sm text-gray-600 mb-4">系统从四个维度分析学生作品，对应《义务教育艺术课程标准（2022年版）》核心素养：</p>
        <div className="space-y-3">
          {[
            { dim: '色彩运用', standard: '审美感知', desc: '颜色表达丰富度与协调性', color: 'bg-rose-100 text-rose-700', border: 'border-rose-200' },
            { dim: '构图完整度', standard: '艺术表现', desc: '画面布局与结构完整性', color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' },
            { dim: '主题契合度', standard: '文化理解', desc: '与主题的相关性表达', color: 'bg-green-100 text-green-700', border: 'border-green-200' },
            { dim: '造型表现力', standard: '创意实践', desc: '造型能力与表现力', color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' }
          ].map((item, i) => (
            <div key={i} className={`p-4 rounded-lg border ${item.border} bg-white`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{item.dim}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.color}`}>{item.standard}</span>
              </div>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">💡 AI分析结果只作为辅助参考，不进入学生评定。</p>
        </div>
      </div>
    )
  },
  {
    id: 'attention',
    title: '多样化表达关注',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium">⭐ 这不是异常筛查</p>
          <p className="text-xs text-amber-600 mt-1">当某幅作品在颜色、构图或主题上与班级整体差异较大时，系统会提示教师「这幅作品值得多看一眼」。这是让教师不轻易错过个性化表达的提醒机制。</p>
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">处理流程</h4>
          {[
            { step: '查看', desc: '查看系统提示的关注原因' },
            { step: '了解', desc: '了解学生创作背景' },
            { step: '释义', desc: '填写「教师释义」' },
            { step: '归档', desc: '作品归入学生档案，不形成负面标签' }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">{item.step}</span>
                <span className="text-sm text-gray-500 ml-1">— {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    id: 'research',
    title: '教研协同',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <h4 className="font-medium text-indigo-800 mb-2">教研管理</h4>
          <ul className="text-xs text-indigo-600 space-y-1">
            <li>• 跟踪每个分析任务的教研闭环状态</li>
            <li>• 查看关注作品的教师释义记录</li>
            <li>• 填写教研结论，记录教学改进方向</li>
          </ul>
        </div>
        <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg">
          <h4 className="font-medium text-teal-800 mb-2">释义记录</h4>
          <ul className="text-xs text-teal-600 space-y-1">
            <li>• 查看所有教师的释义记录历史</li>
            <li>• 为校本资源沉淀提供依据</li>
          </ul>
        </div>
      </div>
    )
  },
  {
    id: 'roles',
    title: '权限说明',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    content: (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">角色</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">权限</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded text-xs font-medium">管理员</span>
                </td>
                <td className="px-4 py-3 text-gray-600">全部功能：用户管理、年级班级管理、数据查看</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">教师</span>
                </td>
                <td className="px-4 py-3 text-gray-600">班级管理（仅查看）、学生管理、作品分析、教研协同</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          学生作品数据仅展示，不存储敏感信息。
        </p>
      </div>
    )
  }
]

export default function Help() {
  const [activeSection, setActiveSection] = useState('quick-start')

  const currentSection = sections.find(s => s.id === activeSection) || sections[0]

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6">
      {/* 左侧目录 */}
      <div className="w-56 flex-shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            系统说明书
          </h2>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2.5 transition-all duration-150 ${
                activeSection === section.id
                  ? 'bg-blue-100 text-blue-700 font-medium shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={activeSection === section.id ? 'text-blue-600' : 'text-gray-400'}>
                {section.icon}
              </span>
              {section.title}
            </button>
          ))}
        </nav>
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <span className="text-blue-600">{currentSection.icon}</span>
            <h1 className="text-lg font-semibold text-gray-800">{currentSection.title}</h1>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {currentSection.content}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import StatCard from '../components/StatCard'
import client from '../api/client'
import { themesApi } from '../api/themes'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [breakdown, setBreakdown] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [classes, setClasses] = useState([])
  const [themes, setThemes] = useState([])
  const [newTask, setNewTask] = useState({ classId: '', theme: '', themeTemplateId: '' })
  const [statusFilter, setStatusFilter] = useState('全部')
  const [collapsedThemes, setCollapsedThemes] = useState({})

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      loadAdminData()
    } else {
      loadTeacherData()
    }
  }, [])

  const loadAdminData = async () => {
    try {
      const [schoolStatsRes, breakdownRes, tasksRes] = await Promise.all([
        client.get(`/stats/school/${user.school_id}`),
        client.get(`/stats/school/${user.school_id}/breakdown`),
        client.get('/tasks')
      ])
      setStats(schoolStatsRes.data)
      setBreakdown(breakdownRes.data || [])
      setTasks(tasksRes.data)
      // 初始化所有主题为收起状态
      const initialCollapsed = {}
      tasksRes.data.forEach(t => {
        const theme = t.theme || '未命名主题'
        initialCollapsed[theme] = true
      })
      setCollapsedThemes(initialCollapsed)
      setLoading(false)
    } catch (err) {
      console.error('Failed to load admin data:', err)
      setLoadError(true)
      setLoading(false)
    }
  }

  const loadTeacherData = async () => {
    try {
      const [tasksRes, classesRes] = await Promise.all([
        client.get('/tasks'),
        client.get('/stats/classes')
      ])
      setTasks(tasksRes.data)
      // 初始化所有主题为收起状态
      const initialCollapsed = {}
      tasksRes.data.forEach(t => {
        const theme = t.theme || '未命名主题'
        initialCollapsed[theme] = true
      })
      setCollapsedThemes(initialCollapsed)
      // 汇总教师所管班级的统计数据
      if (classesRes.data.length > 0) {
        const classIds = classesRes.data.map(c => c.id)
        const statsPromises = classIds.map(id => client.get(`/stats/class/${id}`))
        const statsResults = await Promise.all(statsPromises)
        const combined = statsResults.reduce((acc, { data }) => ({
          total: acc.total + (data.total || 0),
          anomalyCount: acc.anomalyCount + (data.anomalyCount || 0),
          gradeA: acc.gradeA + (data.gradeA || 0),
          gradeB: acc.gradeB + (data.gradeB || 0),
          gradeC: acc.gradeC + (data.gradeC || 0),
          gradeD: acc.gradeD + (data.gradeD || 0),
          avgScore: acc.avgScore + (data.avgScore || 0) * (data.total || 0),
          count: acc.count + (data.total || 0)
        }), { total: 0, anomalyCount: 0, gradeA: 0, gradeB: 0, gradeC: 0, gradeD: 0, avgScore: 0, count: 0 })
        combined.avgScore = combined.count > 0 ? combined.avgScore / combined.count : 0
        setStats(combined)
      } else {
        setStats({ total: 0, anomalyCount: 0, avgScore: 0 })
      }
      setLoading(false)
    } catch (err) {
      console.error('Failed to load teacher data:', err)
      setLoadError(true)
      setLoading(false)
    }
  }

  const openModal = async () => {
    try {
      const [classesRes, themesRes] = await Promise.all([
        client.get('/stats/classes'),
        themesApi.list()
      ])
      setClasses(classesRes.data)
      setThemes(themesRes.data)
      if (classesRes.data[0]) {
        setNewTask(prev => ({
          ...prev,
          classId: classesRes.data[0].id,
          themeTemplateId: themesRes.data[0]?.id || ''
        }))
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!newTask.classId || !newTask.theme.trim()) return
    try {
      const payload = {
        classId: newTask.classId,
        theme: newTask.theme,
      }
      if (newTask.themeTemplateId) payload.themeTemplateId = newTask.themeTemplateId
      const { data } = await client.post('/tasks', payload)
      setShowModal(false)
      setNewTask({ classId: '', theme: '', themeTemplateId: '' })
      navigate(`/analysis/${data.id}`)
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  if (loading) return <div className="text-gray-500">加载中...</div>
  if (loadError) return (
    <div className="text-center py-12">
      <p className="text-red-500 mb-4">加载失败</p>
      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">重试</button>
    </div>
  )

  const filteredTasks = tasks.filter(t => {
    if (statusFilter === '全部') return true
    if (statusFilter === '已完成') return t.status === 'completed'
    if (statusFilter === '进行中') return t.status !== 'completed'
    return true
  })

  const statValues = stats || { total: 0, anomalyCount: 0, avgScore: 0 }

  // 按主题分组的任务列表
  const groupedTasks = filteredTasks.reduce((groups, task) => {
    const theme = task.theme || '未命名主题'
    if (!groups[theme]) groups[theme] = []
    groups[theme].push(task)
    return groups
  }, {})

  const toggleTheme = (theme) => {
    setCollapsedThemes(prev => ({ ...prev, [theme]: !prev[theme] }))
  }

  // 根据评级计算综合评级
  const getOverallGrade = () => {
    if (!stats) return 'C'
    const { gradeA = 0, gradeB = 0, gradeC = 0, gradeD = 0, total = 0 } = stats
    if (total === 0) return 'C'
    const avgScore = stats.avgScore || 0
    if (avgScore >= 85) return 'A'
    if (avgScore >= 70) return 'B'
    return 'C'
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold" data-testid="dashboard-heading">工作台</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? '管理员视角' : '教师视角'} · 欢迎回来，{user?.name || '教师'}
          </p>
        </div>
        <button onClick={openModal} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700" data-testid="create-task-btn">
          + 新建分析任务
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="stats-grid">
        {isAdmin ? (
          <>
            <StatCard label="班级数" value={breakdown.reduce((sum, g) => sum + (g.classCount || 0), 0)} unit="个" />
            <StatCard label="全校已分析作品" value={statValues.total || 0} unit="幅" />
            <StatCard label="全校平均评级" value={getOverallGrade()} unit={`（${Math.round(statValues.avgScore || 0)}）`} />
            <StatCard label="全校关注作品" value={statValues.anomalyCount || 0} unit="幅" />
          </>
        ) : (
          <>
            <StatCard label="进行中任务" value={tasks.filter(t => t.status !== 'completed').length} unit="个" />
            <StatCard label="本月分析作品" value={statValues.total || 0} unit="幅" />
            <StatCard label="班级平均评级" value={getOverallGrade()} unit={`（${Math.round(statValues.avgScore || 0)}）`} />
            <StatCard label="关注作品" value={statValues.anomalyCount || 0} unit="幅" />
          </>
        )}
      </div>

      {/* 年级分布（仅管理员） */}
      {isAdmin && breakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg mb-6">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold">年级分布</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {breakdown.map(grade => (
                <div key={grade.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500 mb-1">{grade.name}</div>
                  <div className="text-2xl font-bold mb-2">{grade.artworkCount || 0}</div>
                  <div className="text-xs text-gray-400">
                    均分 {Math.round(grade.avgScore || 0)} · 关注 {(grade.anomalyCount || 0)}幅
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 图表区（仅管理员） */}
      {isAdmin && breakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* 各班作品数量柱状图 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-4">各班作品数量</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={breakdown.map(g => ({ name: g.name, 作品数: g.artworkCount || 0 }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="作品数" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 全校评级分布 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-4">全校评级分布</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { grade: 'A级', count: statValues.gradeA || 0 },
                { grade: 'B级', count: statValues.gradeB || 0 },
                { grade: 'C级', count: statValues.gradeC || 0 },
                { grade: 'D级', count: statValues.gradeD || 0 },
              ]} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {['#10b981', '#3b82f6', '#f59e0b', '#ef4444'].map((c, i) => <Cell key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 分析任务列表 - 暂时隐藏 */}
      {false && (<div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold" data-testid="tasks-heading">分析任务</h2>
          <div className="flex gap-1">
            {['全部', '已完成', '进行中'].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 text-xs rounded ${statusFilter === f ? 'bg-blue-100 text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {tasks.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p className="mb-2">暂无分析任务</p>
              <button onClick={openModal} className="text-blue-600 text-sm hover:underline">创建第一个任务</button>
            </div>
          ) : Object.keys(groupedTasks).length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无符合筛选条件的任务</div>
          ) : Object.entries(groupedTasks).map(([theme, themeTasks]) => {
            const isCollapsed = collapsedThemes[theme]
            const completedCount = themeTasks.filter(t => t.status === 'completed').length
            return (
              <div key={theme} className="mb-2">
                <div
                  onClick={() => toggleTheme(theme)}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <span className={`transform transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    <span className="font-medium">{theme}</span>
                    <span className="text-xs text-gray-400">({completedCount}/{themeTasks.length})</span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded ${themeTasks.every(t => t.status === 'completed') ? 'bg-green-100 text-green-700' : themeTasks.some(t => t.status !== 'completed') ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {themeTasks.every(t => t.status === 'completed') ? '全部完成' : themeTasks.some(t => t.status === 'completed') ? '进行中' : '待开始'}
                  </span>
                </div>
                {!isCollapsed && themeTasks.map(task => (
                  <div key={task.id}
                    onClick={() => navigate(`/analysis/${task.id}`)}
                    className="flex items-center justify-between py-2 pl-10 pr-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="text-sm">{task.class_name}</div>
                      <div className="text-xs text-gray-400">{new Date(task.created_at).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {task.status === 'completed' ? '已完成' : '进行中'}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>)}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-96 p-6">
            <h3 className="font-semibold text-lg mb-4">新建分析任务</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">选择班级</label>
                <select
                  value={newTask.classId}
                  onChange={e => setNewTask(prev => ({ ...prev, classId: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.grade_name} {c.class_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">课题模板</label>
                <select
                  value={newTask.themeTemplateId}
                  onChange={e => setNewTask(prev => ({ ...prev, themeTemplateId: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">不使用模板</option>
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}（{t.type}）</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">作业主题</label>
                <input
                  type="text"
                  value={newTask.theme}
                  onChange={e => setNewTask(prev => ({ ...prev, theme: e.target.value }))}
                  placeholder="如：我眼中的春天"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50">取消</button>
              <button onClick={handleCreate} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm hover:bg-blue-700">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

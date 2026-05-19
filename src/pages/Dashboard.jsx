import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import StatCard from '../components/StatCard'
import client from '../api/client'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [classes, setClasses] = useState([])
  const [newTask, setNewTask] = useState({ classId: '', theme: '' })
  const [statusFilter, setStatusFilter] = useState('全部')

  useEffect(() => {
    client.get('/tasks').then(({ data }) => {
      setTasks(data)
      if (data[0]) loadStats(data[0].id)
      else setStats({ total: 0, anomalyCount: 0, avgScore: 0 })
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load tasks:', err)
      setLoadError(true)
      setLoading(false)
    })
  }, [])

  const loadStats = async (taskId) => {
    try {
      const { data } = await client.get(`/tasks/${taskId}`)
      setStats(data.stats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
  }

  const openModal = async () => {
    try {
      const { data } = await client.get('/stats/classes')
      setClasses(data)
      if (data[0]) setNewTask(prev => ({ ...prev, classId: data[0].id }))
    } catch (err) {
      console.error('Failed to load classes:', err)
    }
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!newTask.classId || !newTask.theme.trim()) return
    try {
      const { data } = await client.post('/tasks', { classId: newTask.classId, theme: newTask.theme })
      setShowModal(false)
      setNewTask({ classId: '', theme: '' })
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

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold" data-testid="dashboard-heading">工作台</h1>
          <p className="text-gray-500 text-sm mt-1">欢迎回来，{user?.name || '教师'}</p>
        </div>
        <button onClick={openModal} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700" data-testid="create-task-btn">
          + 新建分析任务
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="stats-grid">
        <StatCard label="进行中任务" value={tasks.filter(t => t.status !== 'completed').length} unit="个" />
        <StatCard label="本月分析作品" value={statValues.total || 0} unit="幅" />
        <StatCard label="班级平均评级" value={statValues.avgScore >= 85 ? 'A' : statValues.avgScore >= 70 ? 'B' : 'C'} unit={`（${Math.round(statValues.avgScore || 0)}）`} />
        <StatCard label="异常作品" value={statValues.anomalyCount || 0} unit="幅" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
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
          ) : filteredTasks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">暂无符合筛选条件的任务</div>
          ) : filteredTasks.map(task => (
            <div key={task.id}
              onClick={() => navigate(`/analysis/${task.id}`)}
              className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors">
              <div>
                <div className="font-medium">{task.theme}</div>
                <div className="text-sm text-gray-500">{task.class_name} · {new Date(task.created_at).toLocaleDateString('zh-CN')}</div>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {task.status === 'completed' ? '已完成' : '进行中'}
              </span>
            </div>
          ))}
        </div>
      </div>

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

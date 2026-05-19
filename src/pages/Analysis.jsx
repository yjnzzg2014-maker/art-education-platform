import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ArtworkGrid from '../components/ArtworkGrid'
import ColorChart from '../components/ColorChart'
import DonutChart from '../components/DonutChart'
import StatCard from '../components/StatCard'
import UploadModal from '../components/UploadModal'
import client from '../api/client'
import { useToastStore } from '../stores/toastStore'
import { buildColorDistribution, buildCompositionDistribution, buildGradeDistribution, buildDimensionStats, generateClassCommentary, getGradeLetter } from '../utils/analysisHelpers'

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}′${secs.toString().padStart(2, '0')}″`
}

export default function Analysis() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [tasks, setTasks] = useState([])
  const [artworks, setArtworks] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [students, setStudents] = useState([])
  const taskIdRef = useRef(taskId)
  taskIdRef.current = taskId

  useEffect(() => {
    if (taskId) {
      loadTask()
      loadArtworks()
    } else {
      loadTasks()
    }
  }, [taskId])

  // Poll for analysis status when processing
  useEffect(() => {
    if (!taskId || task?.status !== 'processing') return

    const pollInterval = setInterval(async () => {
      try {
        const { data: updatedTask } = await client.get(`/tasks/${taskId}`)
        setTask(updatedTask)
        if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
          clearInterval(pollInterval)
          loadArtworks(taskIdRef.current)
          if (updatedTask.status === 'failed') {
            useToastStore.getState().show('分析失败，请重试', 'error')
          }
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [taskId, task?.status])

  const loadTask = async () => {
    try {
      const { data } = await client.get(`/tasks/${taskId}`)
      setTask(data)
      // Load students for this class
      if (data.class_id) {
        const { data: studentsData } = await client.get(`/students?classId=${data.class_id}`)
        setStudents(studentsData.data || studentsData)
      }
    } catch (err) {
      console.error('Failed to load task:', err)
    }
  }

  const loadArtworks = async (tid) => {
    const id = tid || taskIdRef.current
    try {
      const { data } = await client.get(`/artworks?taskId=${id}`)
      setArtworks(data)
    } catch (err) {
      console.error('Failed to load artworks:', err)
    }
  }

  const loadTasks = async () => {
    try {
      const { data } = await client.get('/tasks')
      setTasks(data)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }

  if (!taskId) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold">批量作业分析</h1>
          <p className="text-gray-500 text-sm mt-1">选择一个分析任务查看班级整体报告</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold">分析任务列表</h2>
          </div>
          <div className="p-4">
            {tasks.length === 0 ? (
              <div className="text-center text-gray-500 py-8">暂无分析任务</div>
            ) : (
              tasks.map(t => (
                <div key={t.id}
                  onClick={() => navigate(`/analysis/${t.id}`)}
                  className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors">
                  <div>
                    <div className="font-medium">{t.theme}</div>
                    <div className="text-sm text-gray-500">{t.class_name} · {new Date(t.created_at).toLocaleDateString('zh-CN')}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.status === 'completed' ? '已完成' : '进行中'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  const colorDistribution = buildColorDistribution(artworks)
  const compositionDistribution = buildCompositionDistribution(artworks)
  const gradeDistribution = buildGradeDistribution(artworks)
  const dimStats = buildDimensionStats(artworks)
  const classCommentary = generateClassCommentary(dimStats, colorDistribution)

  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }
  const gradeTextColors = { A: 'text-green-600', B: 'text-blue-600', C: 'text-amber-600', D: 'text-red-600' }

  if (!task) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">
          <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/analysis')}>作业分析</span>
          {' / '}{task.class_name}{' / '}{task.theme}
        </div>
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">{task.theme} · 班级作业分析报告</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowUploadModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">+ 导入作品</button>
            {(task.status === 'pending' || task.status === 'completed' || task.status === 'failed') && (
              <button onClick={async () => {
                await client.post(`/tasks/${taskId}/analyze`)
                loadTask()
              }} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                {task.status === 'pending' ? '开始 AI 分析' : '重新 AI 分析'}
              </button>
            )}
            {task.status === 'processing' && (
              <button disabled className="px-4 py-2 bg-amber-100 text-amber-700 rounded text-sm">
                AI 分析中{task.total_count ? ` (${task.processed_count || 0}/${task.total_count})` : '...'}
              </button>
            )}
            <button onClick={async () => {
              const { data } = await client.get(`/tasks/${taskId}/export`)
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = `report-${taskId}.json`; a.click()
              URL.revokeObjectURL(url)
            }} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">导出报告 JSON</button>
            <button className="px-4 py-2 border rounded text-sm hover:bg-gray-50">发起教研讨论</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="已分析作品" value={task.stats?.total || 0} unit="幅" trend={task.analysisDuration ? `分析耗时 ${formatDuration(task.analysisDuration)}` : '分析耗时 7′32″'} trendType="up" />
        <StatCard label="班级平均评级" value={getGradeLetter(task.stats?.avgScore || 0)} unit={`（${Math.round(task.stats?.avgScore || 0)}）`} trend="↑ 较上单元 +2.1" trendType="up" />
        <StatCard label="主色调倾向" value="暖色" unit="68%" trend="冷色使用偏低" trendType="warn" />
        <StatCard label="异常作品" value={task.stats?.anomalyCount || 0} unit="幅" trend="已转入教师释义队列" trendType="warn" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-4">评级分布</h3>
          <div className="flex items-end gap-3 h-32 px-4">
            {gradeDistribution.map(g => (
              <div key={g.grade} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="text-xs text-gray-500 mb-1">{g.count}</div>
                <div className={`w-full ${gradeColors[g.grade]} rounded-t transition-all`}
                  style={{ height: `${artworks.length ? (g.count / artworks.length) * 100 : 0}%`, minHeight: g.count > 0 ? '4px' : '0' }} />
                <div className={`text-xs mt-2 font-medium ${gradeTextColors[g.grade]}`}>{g.grade} ({g.pct}%)</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-4">四维评分统计</h3>
          {dimStats ? (
            <div className="space-y-3">
              {dimStats.map(d => (
                <div key={d.key} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">{d.label}</span>
                    <span className="text-gray-400">
                      {d.min} ~ {d.max} / 均 <span className="font-medium text-gray-700">{d.avg}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded relative">
                    <div className="h-2 bg-blue-400 rounded" style={{ width: `${d.avg}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">暂无数据</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">色彩分布</h3>
            <ColorChart data={colorDistribution} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">构图类型</h3>
            <DonutChart data={compositionDistribution} />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-sm text-blue-800 mb-2">AI 教学建议</h3>
        <p className="text-sm text-blue-700">{classCommentary}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold">作品缩略图</h2>
          <p className="text-xs text-gray-400 mt-1">点击作品可跳转到单幅诊断页面</p>
        </div>
        <div className="p-4" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          <ArtworkGrid artworks={artworks} onSelect={(art) => navigate(`/diagnosis?taskId=${taskId}&artworkId=${art.id}`)} compact />
        </div>
      </div>

      {showUploadModal && (
        <UploadModal
          taskId={taskId}
          students={students}
          onClose={() => setShowUploadModal(false)}
          onUploaded={(result) => {
            setShowUploadModal(false)
            loadArtworks()
            loadTask()
          }}
        />
      )}
    </div>
  )
}

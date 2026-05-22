import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import ArtworkGrid from '../components/ArtworkGrid'
import ColorChart from '../components/ColorChart'
import DonutChart from '../components/DonutChart'
import StatCard from '../components/StatCard'
import UploadModal from '../components/UploadModal'
import client from '../api/client'
import { useToastStore } from '../stores/toastStore'
import { buildColorDistribution, buildCompositionDistribution, buildGradeDistribution, buildDimensionStats, generateClassCommentary, generateClassObservation, getGradeLetter } from '../utils/analysisHelpers'

// 打字机 hook:逐字显示文本,流式输出效果
function useTypewriter(text, speed = 30) {
  const [displayed, setDisplayed] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  useEffect(() => {
    if (!text) { setDisplayed(''); setIsTyping(false); return }
    let i = 0
    setDisplayed('')
    setIsTyping(true)
    const timer = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(timer)
        setIsTyping(false)
      }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])
  return { displayed, isTyping }
}

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
  const [teachingSuggestion, setTeachingSuggestion] = useState('')
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [classObservation, setClassObservation] = useState('')
  const [observationLoading, setObservationLoading] = useState(false)
  // 标记本次会话内是否触发过自动流式(避免重复)
  const aiAutoTriggeredRef = useRef(false)
  // 实时计时器
  const analysisStartTimeRef = useRef(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [expandedThemes, setExpandedThemes] = useState({}) // true=expanded, false=collapsed, undefined=not set
  const taskIdRef = useRef(taskId)
  // 打字机效果(AI 真返回的内容才打字机;静态 fallback 直接显示)
  // 必须放在所有条件返回之前，否则在列表/详情两个分支之间切换会触发 hooks 顺序变化
  const { displayed: typedObservation, isTyping: observationTyping } = useTypewriter(classObservation, 25)
  const { displayed: typedSuggestion, isTyping: suggestionTyping } = useTypewriter(teachingSuggestion, 25)
  taskIdRef.current = taskId

  useEffect(() => {
    if (taskId) {
      loadTask()
      loadArtworks()
    } else {
      loadTasks()
    }
  }, [taskId])

  // Poll for analysis status when processing/paused
  useEffect(() => {
    if (!taskId || (task?.status !== 'processing' && task?.status !== 'paused')) return

    const pollInterval = setInterval(async () => {
      try {
        const { data: updatedTask } = await client.get(`/tasks/${taskId}`)
        setTask(updatedTask)
        // 每批分析完后实时刷新 artworks + stats，让统计卡片同步更新
        loadTask()
        loadArtworks(taskIdRef.current)
        if (updatedTask.status === 'completed' || updatedTask.status === 'failed' || updatedTask.status === 'stopped') {
          clearInterval(pollInterval)
          if (updatedTask.status === 'failed') {
            useToastStore.getState().show('分析失败，请重试', 'error')
          } else if (updatedTask.status === 'stopped') {
            useToastStore.getState().show('分析已停止', 'info')
          }
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [taskId, task?.status])

  // 实时计时：分析进行中每秒更新 elapsed，完成/停止后停在最终值
  useEffect(() => {
    if (task?.status === 'processing' || task?.status === 'paused') {
      if (!analysisStartTimeRef.current) {
        analysisStartTimeRef.current = Date.now()
        setElapsedTime(0)
      }
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - analysisStartTimeRef.current) / 1000))
      }, 1000)
      return () => clearInterval(timer)
    } else if (task?.status === 'completed' || task?.status === 'failed' || task?.status === 'stopped') {
      if (analysisStartTimeRef.current) {
        setElapsedTime(Math.floor((Date.now() - analysisStartTimeRef.current) / 1000))
        analysisStartTimeRef.current = null
      }
    }
  }, [task?.status])

  const refreshSuggestion = () => {
    if (!taskId) return
    setSuggestionLoading(true)
    client.post(`/tasks/${taskId}/teaching-suggestions?refresh=true`)
      .then(({ data }) => {
        setTeachingSuggestion(data.suggestion || classCommentary)
      })
      .catch(() => {
        setTeachingSuggestion(classCommentary)
      })
      .finally(() => setSuggestionLoading(false))
  }

  const refreshObservation = () => {
    if (!taskId) return
    setObservationLoading(true)
    client.post(`/tasks/${taskId}/class-observation?refresh=true`)
      .then(({ data }) => {
        if (data.observation) setClassObservation(data.observation)
      })
      .catch(() => {})
      .finally(() => setObservationLoading(false))
  }

  // 分析完成后自动触发真 AI 生成班级观察笔记 + 教学建议(本次会话只触发一次)
  useEffect(() => {
    if (!task || task.status !== 'completed') return
    if (aiAutoTriggeredRef.current) return
    aiAutoTriggeredRef.current = true

    // 班级观察笔记
    setObservationLoading(true)
    client.post(`/tasks/${taskId}/class-observation`)
      .then(({ data }) => {
        if (data.observation) setClassObservation(data.observation)
      })
      .catch(() => {})
      .finally(() => setObservationLoading(false))

    // AI 教学建议(如果未缓存)
    if (!task.teaching_suggestion) {
      setSuggestionLoading(true)
      client.post(`/tasks/${taskId}/teaching-suggestions`)
        .then(({ data }) => {
          if (data.suggestion) setTeachingSuggestion(data.suggestion)
        })
        .catch(() => {})
        .finally(() => setSuggestionLoading(false))
    }
  }, [task?.status, taskId])

  // 切换任务时重置自动触发标记
  useEffect(() => {
    aiAutoTriggeredRef.current = false
    setClassObservation('')
    analysisStartTimeRef.current = null
    setElapsedTime(0)
  }, [taskId])

  const loadTask = async () => {
    try {
      const { data } = await client.get(`/tasks/${taskId}`)
      setTask(data)
      if (data.teaching_suggestion) {
        setTeachingSuggestion(data.teaching_suggestion)
      }
      const cachedObservation = data.result_summary?.observation
      if (cachedObservation) {
        setClassObservation(cachedObservation)
      }
      // Load students for this class
      if (data.class_id) {
        const { data: studentsData } = await client.get('/students', { params: { classId: data.class_id, limit: 1000 } })
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
    // Group tasks by theme
    const grouped = tasks.reduce((acc, t) => {
      if (!acc[t.theme]) acc[t.theme] = []
      acc[t.theme].push(t)
      return acc
    }, {})

    const isSingleTheme = Object.keys(grouped).length === 1

    const toggleTheme = (theme) => {
      setExpandedThemes(prev => ({ ...prev, [theme]: !prev[theme] }))
    }

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
              Object.entries(grouped).map(([theme, themeTasks]) => {
                const isExpanded = isSingleTheme || expandedThemes[theme] === true
                return (
                  <div key={theme} className="mb-2 last:mb-0">
                    <div
                      onClick={() => toggleTheme(theme)}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <span className="font-medium">{theme}</span>
                        <span className="text-xs text-gray-400">({themeTasks.length}个班级)</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {themeTasks.filter(t => t.status === 'completed').length}/{themeTasks.length} 已完成
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mt-1">
                        {themeTasks.map(t => (
                          <div key={t.id}
                            onClick={() => navigate(`/analysis/${t.id}`)}
                            className="flex items-center justify-between py-2 pl-8 pr-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition-colors">
                            <div>
                              <div className="text-sm">{t.class_name}</div>
                              <div className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('zh-CN')}</div>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {t.status === 'completed' ? '已完成' : '进行中'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
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
  // 静态 fallback(未连接 AI 时使用)
  const fallbackObservation = generateClassObservation(dimStats, colorDistribution)
  const classCommentary = generateClassCommentary(dimStats, colorDistribution)
  // 实际显示的文本:优先 AI 真生成,fallback 到静态
  const observationText = classObservation || fallbackObservation
  const suggestionText = teachingSuggestion || classCommentary
  // typedObservation / typedSuggestion 已在组件顶部声明（必须在条件返回之前）

  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }
  const gradeTextColors = { A: 'text-green-600', B: 'text-blue-600', C: 'text-amber-600', D: 'text-red-600' }

  // 班级多维趋势：来自 task.result_summary。分析完成后会追加本次条目到末尾，
  // 与历次同班同主题表现形成对比。
  const allTrend = Array.isArray(task?.result_summary?.trend) ? task.result_summary.trend : null
  const trendData = allTrend && allTrend.length ? allTrend : null
  // 倾向词云：仅在分析完成后才显示
  const wordCloud = task?.status === 'completed' && Array.isArray(task?.result_summary?.wordcloud)
    ? task.result_summary.wordcloud
    : null
  const wordCloudColors = ['text-blue-600', 'text-emerald-600', 'text-purple-600', 'text-amber-600', 'text-rose-600', 'text-cyan-600', 'text-indigo-600']

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
            {(task.status === 'pending' || task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') && (
              <button onClick={async () => {
                try {
                  // 重置 AI 自动触发标记和状态
                  aiAutoTriggeredRef.current = false
                  setClassObservation('')
                  setTeachingSuggestion('')
                  analysisStartTimeRef.current = null
                  setElapsedTime(0)
                  const { data } = await client.post(`/tasks/${taskId}/analyze`)
                  setTask(prev => ({ ...prev, status: data.status, total_count: prev.total_count, processed_count: 0 }))
                  await loadTask()
                } catch (err) {
                  console.error('分析失败:', err)
                }
              }} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                {task.status === 'pending' ? '开始 AI 分析' : task.status === 'stopped' ? '继续 AI 分析' : '重新 AI 分析'}
              </button>
            )}
            {task.status === 'processing' && (
              <>
                <button onClick={async () => { await client.post(`/tasks/${taskId}/pause`); await loadTask() }} className="px-4 py-2 bg-amber-500 text-white rounded text-sm hover:bg-amber-600">暂停</button>
                <button onClick={async () => { await client.post(`/tasks/${taskId}/stop`); await loadTask() }} className="px-4 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600">停止</button>
                <span className="px-4 py-2 text-amber-600 text-sm">
                  AI 分析中{task.total_count ? ` (${task.processed_count || 0}/${task.total_count})` : '...'} · {formatDuration(elapsedTime) || '0′00″'}
                </span>
              </>
            )}
            {task.status === 'paused' && (
              <>
                <button onClick={async () => { await client.post(`/tasks/${taskId}/resume`); await loadTask() }} className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600">继续</button>
                <button onClick={async () => { await client.post(`/tasks/${taskId}/stop`); await loadTask() }} className="px-4 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600">停止</button>
                <span className="px-4 py-2 text-amber-600 text-sm">
                  已暂停 {task.total_count ? `(${task.processed_count || 0}/${task.total_count})` : ''} · {formatDuration(elapsedTime) || '0′00″'}
                </span>
              </>
            )}
            <button onClick={async () => {
              const { data } = await client.get(`/tasks/${taskId}/export`)
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = `report-${taskId}.json`; a.click()
              URL.revokeObjectURL(url)
            }} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">导出报告 JSON</button>
            <button onClick={() => navigate('/research')} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">发起教研讨论</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="已分析作品"
          value={task.stats?.total || 0}
          unit="幅"
          trend={elapsedTime > 0 ? `分析耗时 ${formatDuration(elapsedTime)}` : task.analysisDuration ? `分析耗时 ${formatDuration(task.analysisDuration)}` : '暂无分析记录'}
          trendType={task.analysisDuration ? 'up' : 'neutral'}
        />
        <StatCard
          label="班级平均评级"
          value={getGradeLetter(task.stats?.avgScore || 0)}
          unit={`（${Math.round(task.stats?.avgScore || 0)}）`}
          trend={task.stats?.total ? `共 ${task.stats.total} 幅作品` : '暂无数据'}
          trendType="up"
        />
        <StatCard
          label="主色调倾向"
          value={colorDistribution[0]?.color || '暂无数据'}
          unit={colorDistribution[0]?.pct ? `${colorDistribution[0].pct}%` : ''}
          trend={colorDistribution.length > 1 ? `次为${colorDistribution[1].color}` : ''}
          trendType={colorDistribution[0]?.pct > 50 ? 'warn' : 'neutral'}
        />
        <StatCard
          label="关注作品"
          value={task.stats?.anomalyCount || 0}
          unit="幅"
          trend={task.stats?.anomalyCount > 0 ? '已转入教师释义队列' : '无需关注'}
          trendType={task.stats?.anomalyCount > 0 ? 'warn' : 'up'}
        />
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
          {dimStats && dimStats.some(d => d.avg > 0) ? (() => {
              const vals = dimStats.map(d => d.avg).filter(v => v > 0)
              // 放大差异：以最小值往下浮动 8 分为下界(不低于 40)，让维度间差距更直观
              const lo = Math.max(40, Math.floor(Math.min(...vals) - 8))
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={dimStats.map(d => ({ name: d.label, value: d.avg, fullMark: 100 }))}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Radar
                      name="班级均值"
                      dataKey="value"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.3}
                      strokeWidth={2.5}
                      isAnimationActive={true}
                      animationDuration={1400}
                      animationEasing="ease-out"
                      dot={{ fill: '#6366f1', r: 4 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )
            })() : (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* 班级多维趋势 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">📈 班级多维趋势</h3>
            <span className="text-xs text-gray-400">本班同类主题历次表现</span>
          </div>
          {trendData && trendData.length > 0 ? (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} domain={[60, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                    <Line type="monotone" dataKey="color"       name="色彩" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={true} animationDuration={1200} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="composition" name="构图" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={true} animationDuration={1200} animationBegin={150} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="theme"       name="主题" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={true} animationDuration={1200} animationBegin={300} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="expression"  name="造型" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={true} animationDuration={1200} animationBegin={450} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">跨主题对比仅供参考，受作业难度差异影响。</p>
            </>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">暂无历史趋势数据</div>
          )}
        </div>

        {/* 班级倾向词云 */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">☁️ 班级倾向词云</h3>
            <span className="text-xs text-gray-400">本次作品高频特征</span>
          </div>
          {wordCloud ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-2">
              {wordCloud.map((w, i) => {
                const max = Math.max(...wordCloud.map(x => x.weight))
                const min = Math.min(...wordCloud.map(x => x.weight))
                const ratio = max === min ? 0.5 : (w.weight - min) / (max - min)
                const fontSize = 12 + Math.round(ratio * 18)
                const opacity = 0.55 + ratio * 0.45
                return (
                  <span
                    key={w.word}
                    className={`${wordCloudColors[i % wordCloudColors.length]} font-medium leading-none`}
                    style={{ fontSize, opacity }}
                    title={`权重 ${w.weight}`}
                  >
                    {w.word}
                  </span>
                )
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm text-center px-4">
              {task?.status === 'completed' ? '暂无词云数据' : '分析完成后自动生成词云'}
            </div>
          )}
          {wordCloud && <p className="text-xs text-gray-400 mt-2 italic text-center">词大小代表出现频次</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm text-amber-900">📝 班级观察笔记</h3>
            <div className="flex items-center gap-2">
              {classObservation && <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">AI 生成</span>}
              {task?.status === 'completed' && (
                <button
                  onClick={refreshObservation}
                  disabled={observationLoading}
                  className="text-xs text-amber-700 hover:text-amber-900 disabled:opacity-50"
                >
                  {observationLoading ? '生成中...' : '刷新'}
                </button>
              )}
            </div>
          </div>
          {observationLoading && !classObservation ? (
            <p className="text-sm text-amber-500 italic flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              AI 正在生成观察笔记...
            </p>
          ) : classObservation ? (
            <p className="text-sm text-amber-900 leading-relaxed">
              {typedObservation}
              {observationTyping && <span className="inline-block w-1 h-4 ml-0.5 bg-amber-600 animate-pulse align-middle" />}
            </p>
          ) : (
            <p className="text-sm text-amber-900 leading-relaxed">{fallbackObservation}</p>
          )}
          <p className="text-xs text-amber-600 mt-2 italic">仅为观察参考，最终评价由教师释义定稿。</p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm text-blue-800">💡 AI 教学建议</h3>
            <div className="flex items-center gap-2">
              {teachingSuggestion && <span className="text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">AI 生成</span>}
              {task?.status === 'completed' && (
                <button
                  onClick={refreshSuggestion}
                  disabled={suggestionLoading}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {suggestionLoading ? '生成中...' : '刷新'}
                </button>
              )}
            </div>
          </div>
          {suggestionLoading && !teachingSuggestion ? (
            <p className="text-sm text-blue-400 italic flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              AI 正在生成教学建议...
            </p>
          ) : teachingSuggestion ? (
            <p className="text-sm text-blue-700 leading-relaxed">
              {typedSuggestion}
              {suggestionTyping && <span className="inline-block w-1 h-4 ml-0.5 bg-blue-600 animate-pulse align-middle" />}
            </p>
          ) : (
            <p className="text-sm text-blue-700 leading-relaxed">{classCommentary}</p>
          )}
          <p className="text-xs text-blue-500 mt-2 italic">仅为建议，是否落地由教师判断。</p>
        </div>
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

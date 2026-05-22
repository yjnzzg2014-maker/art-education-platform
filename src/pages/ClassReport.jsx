import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from 'recharts'
import { classesApi } from '../api/classes'
import { useToastStore } from '../stores/toastStore'

function useTypewriter(text, speed = 25) {
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
      if (i >= text.length) { clearInterval(timer); setIsTyping(false) }
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])
  return { displayed, isTyping }
}

const DIM_KEYS = [
  { key: 'color',       label: '色彩运用', stroke: '#ef4444' },
  { key: 'composition', label: '构图完整度', stroke: '#3b82f6' },
  { key: 'theme',       label: '主题契合度', stroke: '#10b981' },
  { key: 'expression',  label: '造型表现力', stroke: '#f59e0b' }
]

const COLOR_HEX = { '红':'#ef4444','橙':'#f97316','黄':'#facc15','绿':'#22c55e','青':'#06b6d4','蓝':'#3b82f6','紫':'#8b5cf6','粉':'#ec4899','棕':'#a16207','灰':'#9ca3af','黑':'#1f2937' }

export default function ClassReport() {
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToastStore(s => s.show)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState(() => {
    const fromUrl = Number(searchParams.get('classId'))
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : null
  })

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 班级列表
  useEffect(() => {
    classesApi.list().then(res => {
      setClasses(res.data || [])
      if (!classId && res.data?.length) {
        const first = res.data[0].id
        setClassId(first)
        setSearchParams({ classId: String(first) }, { replace: true })
      }
    }).catch(() => {})
  }, [])

  // 拉取报告
  useEffect(() => {
    if (!classId) return
    let cancelled = false
    setLoading(true)
    setError('')
    classesApi.teachingSuggestion(classId)
      .then(res => { if (!cancelled) setReport(res.data) })
      .catch(err => {
        if (cancelled) return
        const msg = err?.response?.data?.error || '加载失败'
        setError(msg)
        setReport(null)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [classId])

  const handleClassChange = (id) => {
    setClassId(id)
    setSearchParams({ classId: String(id) }, { replace: true })
  }

  const handleRefresh = async () => {
    if (!classId || refreshing) return
    setRefreshing(true)
    try {
      const res = await classesApi.teachingSuggestion(classId, { refresh: true })
      setReport(res.data)
      toast('已基于最新数据重新生成', 'success')
    } catch (err) {
      toast(err?.response?.data?.error || '刷新失败', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const radarData = useMemo(() => {
    if (!report?.timeline?.length) return []
    const last = report.timeline[report.timeline.length - 1]
    return DIM_KEYS.map(d => ({ name: d.label, value: last.dims[d.key], fullMark: 100 }))
  }, [report])

  const lineData = useMemo(() => {
    if (!report?.timeline) return []
    return report.timeline.map((t, i) => ({
      idx: i + 1,
      name: t.theme.length > 5 ? t.theme.slice(0, 5) + '…' : t.theme,
      ...t.dims
    }))
  }, [report])

  const { displayed: typedSuggestion, isTyping } = useTypewriter(report?.content || '', 22)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-4 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">班级阶段教学建议</h1>
          <p className="text-xs text-gray-500 mt-1">
            基于最近 {report?.timeline?.length || 5} 次已完成作业累积的观察，AI 生成的辅助参考 · 缓存 7 天
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={classId || ''}
            onChange={e => handleClassChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.grade_name}{c.name}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={!classId || refreshing || loading}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? '生成中…' : '重新生成'}
          </button>
        </div>
      </header>

      {loading && (
        <div className="bg-white rounded-lg p-12 text-center text-gray-400 text-sm">加载中…</div>
      )}

      {!loading && error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-sm text-yellow-800">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <div className="space-y-4">
          {/* 上半部：雷达 + 折线 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 雷达 */}
            <div className="lg:col-span-2 bg-white rounded-lg p-4 border border-gray-100">
              <div className="text-xs tracking-widest text-gray-400 mb-1">CLASS PROFILE</div>
              <div className="font-semibold text-gray-800 mb-3">
                {report.class.grade_name}{report.class.name} · 四维雷达（最新一次）
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Radar
                      name="均分"
                      dataKey="value"
                      stroke="#4DABF7"
                      fill="#4DABF7"
                      fillOpacity={0.35}
                      isAnimationActive
                      animationDuration={1000}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 折线 */}
            <div className="lg:col-span-3 bg-white rounded-lg p-4 border border-gray-100">
              <div className="text-xs tracking-widest text-gray-400 mb-1">TREND</div>
              <div className="font-semibold text-gray-800 mb-3">
                四维趋势 · 近 {report.timeline.length} 次作业
              </div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis domain={[40, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {DIM_KEYS.map(d => (
                      <Line
                        key={d.key}
                        type="monotone"
                        dataKey={d.key}
                        name={d.label}
                        stroke={d.stroke}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        isAnimationActive
                        animationDuration={1000}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 中部：颜色分布 + 构图分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="text-xs tracking-widest text-gray-400 mb-3">累计色彩倾向</div>
              <div className="flex flex-wrap gap-2">
                {(report.colorTrend || []).slice(0, 8).map(c => (
                  <span key={c.color} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ background: COLOR_HEX[c.color] || '#999' }} />
                    {c.color} · {c.pct}%
                  </span>
                ))}
                {!report.colorTrend?.length && <span className="text-xs text-gray-400">暂无</span>}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="text-xs tracking-widest text-gray-400 mb-3">累计构图类型</div>
              <div className="flex flex-wrap gap-2">
                {(report.compTrend || []).map(c => (
                  <span key={c.type} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 border border-blue-100 text-xs text-blue-800">
                    {c.type} · {c.pct}%（{c.count}人次）
                  </span>
                ))}
                {!report.compTrend?.length && <span className="text-xs text-gray-400">暂无</span>}
              </div>
            </div>
          </div>

          {/* 下半部：AI 建议 */}
          <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-5 border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-xs tracking-widest text-gray-400">TEACHING SUGGESTION</div>
                {report.source === 'ai' && (
                  <span className="text-[10px] bg-purple-600 text-white px-2 py-0.5 rounded-full font-semibold tracking-wider">AI 生成</span>
                )}
                {report.source === 'cached' && (
                  <span className="text-[10px] bg-gray-400 text-white px-2 py-0.5 rounded-full">缓存</span>
                )}
                {report.source === 'local' && (
                  <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full">本地兜底</span>
                )}
              </div>
              <div className="text-[11px] text-gray-400">
                生成于 {report.generated_at?.slice(0, 16).replace('T', ' ')}
                {report.expires_at && <span className="ml-2">· 缓存至 {report.expires_at.slice(0, 10)}</span>}
              </div>
            </div>

            <div className="text-sm leading-7 text-gray-700 whitespace-pre-wrap min-h-[120px]">
              {typedSuggestion}
              {isTyping && <span className="inline-block w-1.5 h-4 bg-purple-500 align-middle ml-0.5 animate-pulse" />}
            </div>

            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded bg-rose-50 border border-rose-100 text-xs text-rose-700">
              <span>★</span>
              这只是辅助参考。下一节课怎么上、要不要采纳，仍由你结合课堂实际自主决定。
            </div>
          </div>

          {/* 任务来源 */}
          <div className="text-[11px] text-gray-400 px-1">
            基于以下 {report.timeline?.length} 个已完成任务：
            {(report.timeline || []).map((t, i) => (
              <span key={t.task_id}>
                {i > 0 && ' · '}
                <span className="text-gray-500">{t.date.slice(0, 10)}「{t.theme}」</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

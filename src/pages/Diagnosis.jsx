import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import DimensionAnalysis from '../components/DimensionAnalysis'
import MaskName from '../components/MaskName'
import ArtworkThumbnailStrip from '../components/ArtworkThumbnailStrip'
import ReviewModal from '../components/ReviewModal'
import useDiagnosisData from '../hooks/useDiagnosisData'
import { buildColorDistribution } from '../utils/analysisHelpers'
import ColorChart from '../components/ColorChart'
import { getAnomalyLevel } from '../components/ArtworkGrid'
import client from '../api/client'

export default function Diagnosis() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const initialTaskId = searchParams.get('taskId')
  const initialArtworkId = searchParams.get('artworkId')

  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId ? Number(initialTaskId) : null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeSource, setAnalyzeSource] = useState(null)
  const [toast, setToast] = useState(null)
  const colRef = useRef(null)

  const { tasks, artworks, context, loading, selectArtwork, submitReview } = useDiagnosisData(selectedTaskId, initialArtworkId ? Number(initialArtworkId) : null)

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id)
    }
  }, [tasks])

  // 清除右侧列中游离的 text node（如浏览器解析产生的孤立 "0"）
  useEffect(() => {
    const col = colRef.current
    if (!col) return
    const remove = () => {
      Array.from(col.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '0') {
          col.removeChild(node)
        }
      })
    }
    remove()
    const timer = setTimeout(remove, 500)
    return () => clearTimeout(timer)
  }, [context])

  const artwork = context?.artwork
  const classAvg = context?.classAvg
  const studentHistory = context?.studentHistory || []

  const currentTask = tasks.find(t => t.id === selectedTaskId)

  const historyChartData = studentHistory
    .filter(w => w.total_score != null && w.total_score > 0)
    .sort((a, b) => new Date(a.upload_time) - new Date(b.upload_time))
    .map(w => ({
      date: new Date(w.upload_time).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      score: w.total_score
    }))

  const artworkColorDist = artwork?.scores?.colorDist
    ? buildColorDistribution([{ scores: { colorDist: artwork.scores.colorDist } }])
    : []

  const handleReviewSubmit = ({ comment, override }) => {
    if (artwork) {
      submitReview(artwork.id, comment, override)
    }
    setReviewModalOpen(false)
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleAnalyze = async () => {
    if (!artwork || analyzing) return
    setAnalyzing(true)
    setAnalyzeSource(null)
    try {
      const { data } = await client.post(`/artworks/${artwork.id}/analyze`)
      const source = data.source || 'unknown'
      setAnalyzeSource(source)
      selectArtwork(artwork.id)
      if (source === 'ai') {
        showToast(`AI 分析完成（模型: MiniMax-M2.7，总分: ${data.totalScore}，等级: ${data.grade}）`)
      } else {
        showToast('已使用本地算法评分（未连接 AI 服务）', 'warn')
      }
    } catch (err) {
      showToast('分析请求失败: ' + (err.response?.data?.error || err.message), 'error')
    }
    setAnalyzing(false)
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'warn' ? 'bg-amber-500 text-white' :
          'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">
          {currentTask ? `作业诊断 / ${currentTask.class_name} / ${currentTask.theme}` : '作业诊断'}
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/analysis${selectedTaskId ? '/' + selectedTaskId : ''}`)}
              className="p-2 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="返回"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold">单幅作品诊断</h1>
          </div>
          <select
            value={selectedTaskId || ''}
            onChange={(e) => setSelectedTaskId(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tasks.map(task => (
              <option key={task.id} value={task.id}>
                {task.class_name} - {task.theme}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!artwork ? (
        <div className="text-gray-500 py-8 text-center">
          {loading ? '加载中...' : artworks.length === 0 ? '暂无作品' : '请选择作品'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4 mb-4" style={{ height: 'calc(100vh - 280px)' }}>
            <div className="col-span-2 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-semibold"><MaskName name={artwork.student_name} /></h2>
                    <span className="text-xs text-gray-500">{artwork.class_name} · {artwork.student_no}</span>
                  </div>
                  {artwork.is_anomaly && getAnomalyLevel(artwork) === 'warn' ? (
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap animate-pulse" title={`系统警告：${artwork.anomaly_reason || '需教师关注'}`}>
                      ⚠ 需教师关注
                    </span>
                  ) : artwork.is_anomaly ? (
                    <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap" title="系统提示：这幅作品值得多看一眼">
                      值得多看一眼
                    </span>
                  ) : null}
                </div>
                <div className="bg-gray-100 rounded flex items-center justify-center" style={{ maxHeight: '500px' }}>
                  {artwork.image_url ? (
                    <img src={artwork.image_url} alt={artwork.student_name} className="max-h-[500px] w-full object-contain rounded" />
                  ) : (
                    <div className="h-64 w-full bg-gradient-to-br from-gray-300 to-gray-500 rounded" />
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between"><span>作品ID</span><span>#{artwork.id}</span></div>
                  <div className="flex justify-between"><span>采集时间</span><span>{new Date(artwork.upload_time).toLocaleString('zh-CN')}</span></div>
                  {artwork.scores?.compositionType && (
                    <div className="flex justify-between"><span>构图类型</span><span className="font-medium text-gray-700">{artwork.scores.compositionType}</span></div>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex-1 bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                  >
                    {analyzing ? 'AI 分析中...' : '重新 AI 分析'}
                  </button>
                  <button onClick={() => setReviewModalOpen(true)} className="flex-1 bg-green-500 text-white py-2 rounded text-sm hover:bg-green-600">
                    {artwork.review ? '补充教师释义' : '教师释义'}
                  </button>
                </div>
              </div>

              {artwork.review && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
                  <div className="flex justify-between mb-1">
                    <strong>教师释义记录</strong>
                    <span className="text-gray-400">{artwork.review.teacher_name} · {new Date(artwork.review.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                  <p className="italic pl-2 border-l-2 border-green-500">{artwork.review.comment}</p>
                </div>
              )}
            </div>

            <div ref={colRef} className="col-span-3 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-sm">四维分数诊断</h3>
                  {analyzeSource && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${analyzeSource === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {analyzeSource === 'ai' ? 'AI 评分' : '本地算法'}
                    </span>
                  )}
                </div>
                <DimensionAnalysis scores={artwork.scores} classAvg={classAvg} />
              </div>

              {(artwork.scores?.summary || artwork.scores?.commentary) && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {artwork.scores.summary && (
                    <div className="mb-3">
                      <h3 className="font-semibold text-sm mb-1">总评</h3>
                      <p className="text-sm text-gray-800 leading-relaxed">{artwork.scores.summary}</p>
                    </div>
                  )}
                  {artwork.scores.commentary && (
                    <div>
                      <h3 className="font-semibold text-sm mb-1">详细评语</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{artwork.scores.commentary}</p>
                    </div>
                  )}
                </div>
              )}

              {artwork.is_anomaly && (() => {
                const isWarn = getAnomalyLevel(artwork) === 'warn'
                return (
                  <div className={isWarn ? 'bg-red-50 border-2 border-red-300 rounded-lg p-4' : 'bg-amber-50 border border-amber-200 rounded-lg p-4'}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-semibold text-sm ${isWarn ? 'text-red-700' : 'text-amber-800'}`}>
                        {isWarn ? '⚠ 系统警告 · 需教师关注' : '系统提示 · 值得多看一眼'}
                      </h3>
                      {isWarn && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">建议优先释义</span>
                      )}
                    </div>
                    <p className={`text-sm leading-relaxed ${isWarn ? 'text-red-700' : 'text-amber-700'}`}>{artwork.anomaly_reason}</p>
                    {isWarn && !artwork.review && (
                      <p className="mt-2 text-xs text-red-500 italic">系统识别为需要教师跟进的作品，请在与孩子沟通后写入教师释义。</p>
                    )}
                  </div>
                )
              })()}

              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">作品色彩分布</h3>
                <ColorChart data={artworkColorDist} />
              </div>

              {historyChartData.length > 1 && historyChartData.some(d => d.score > 0) && (
                <div
                  onClick={() => navigate(`/growth?studentId=${artwork.student_id}`)}
                  className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <h3 className="font-semibold text-sm mb-3">该学生历史分数趋势</h3>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyChartData}>
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-2">同任务作品（点击切换）</div>
            <ArtworkThumbnailStrip artworks={artworks} selectedId={artwork.id} onSelect={(art) => selectArtwork(art.id)} />
          </div>
        </>
      )}

      {reviewModalOpen && (
        <ReviewModal
          artworkId={artwork?.id}
          studentName={artwork?.student_name}
          initialComment={!artwork?.review ? (artwork?.review_draft || artwork?.scores?.reviewDraft || '') : ''}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewModalOpen(false)}
        />
      )}
    </div>
  )
}

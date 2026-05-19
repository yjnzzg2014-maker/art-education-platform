import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import MaskName from '../components/MaskName'

export default function Research() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedArtworks, setExpandedArtworks] = useState([])
  const [conclusions, setConclusions] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: tasks } = await client.get('/tasks')

      const researchTopics = tasks.map(task => ({
        id: task.id,
        theme: task.theme,
        class_name: task.class_name,
        status: task.status,
        created_at: task.created_at,
        total_artworks: task.totalArtworks || 0,
        anomaly_count: task.anomalyCount || 0,
        reviewed_count: task.reviewedCount || 0,
        research_conclusion: task.research_conclusion || '',
        closure_status: getClosureStatus(task.anomalyCount || 0, task.reviewedCount || 0)
      }))

      setTopics(researchTopics)
      const initConclusions = {}
      researchTopics.forEach(t => { initConclusions[t.id] = t.research_conclusion })
      setConclusions(initConclusions)
    } catch (err) {
      console.error('Failed to load research topics:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = async (topicId) => {
    if (expandedId === topicId) {
      setExpandedId(null)
      setExpandedArtworks([])
      return
    }
    setExpandedId(topicId)
    try {
      const { data } = await client.get(`/artworks?taskId=${topicId}`)
      setExpandedArtworks(data.filter(a => a.is_anomaly))
    } catch (err) {
      console.error('Failed to load artworks:', err)
      setExpandedArtworks([])
    }
  }

  const saveConclusion = async (topicId) => {
    setSaving(true)
    try {
      await client.patch(`/tasks/${topicId}`, { research_conclusion: conclusions[topicId] || '' })
    } catch (err) {
      console.error('Failed to save conclusion:', err)
    } finally {
      setSaving(false)
    }
  }

  function getClosureStatus(anomalyCount, reviewedCount) {
    if (anomalyCount === 0) return { label: '已完成', color: 'green', desc: '无异常作品' }
    if (reviewedCount === 0) return { label: '未开始', color: 'red', desc: '待教师释义' }
    if (reviewedCount >= anomalyCount) return { label: '已完成', color: 'green', desc: '全部复核' }
    return { label: '进行中', color: 'amber', desc: '部分复核' }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  if (loading) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">教研管理</h1>
          <p className="text-gray-500 text-sm mt-1">基于分析任务管理教研议题，跟踪教研闭环</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">教研任务</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{topics.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">待复核异常</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {topics.reduce((sum, t) => sum + Math.max(0, t.anomaly_count - t.reviewed_count), 0)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">已复核</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {topics.reduce((sum, t) => sum + t.reviewed_count, 0)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">完成闭环</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {topics.filter(t => t.closure_status.label === '已完成').length}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {topics.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            <p>暂无教研议题</p>
            <p className="text-sm mt-2">创建分析任务后可生成教研议题</p>
          </div>
        ) : (
          topics.map(topic => (
            <div key={topic.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleExpand(topic.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-gray-400">{expandedId === topic.id ? '▼' : '▶'}</span>
                      <h3 className="font-medium text-gray-900">{topic.theme}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        topic.closure_status.color === 'green' ? 'bg-green-100 text-green-700' :
                        topic.closure_status.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {topic.closure_status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 ml-6">
                      <span>{topic.class_name}</span>
                      <span>·</span>
                      <span>{formatDate(topic.created_at)}</span>
                      <span>·</span>
                      <span>{topic.total_artworks} 幅作品</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">异常 / 已复核</div>
                      <div className="text-lg font-semibold">
                        <span className="text-red-600">{topic.anomaly_count}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-green-600">{topic.reviewed_count}</span>
                      </div>
                    </div>
                    <Link to={`/analysis/${topic.id}`} onClick={e => e.stopPropagation()}
                      className="px-4 py-2 border border-gray-200 rounded text-sm hover:bg-gray-50">
                      查看报告
                    </Link>
                  </div>
                </div>
              </div>

              {expandedId === topic.id && (
                <div className="border-t border-gray-200">
                  {expandedArtworks.length > 0 && (
                    <div className="p-4 bg-gray-50">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">异常作品详情</h4>
                      <div className="grid grid-cols-4 gap-3">
                        {expandedArtworks.map(art => (
                          <div key={art.id} className="bg-white border border-gray-200 rounded p-2">
                            <div className="h-20 bg-gray-100 rounded mb-2">
                              {art.image_url ? (
                                <img src={art.image_url} alt={art.student_name} className="w-full h-full object-contain rounded" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-400 rounded" />
                              )}
                            </div>
                            <div className="text-xs">
                              <div className="font-medium truncate"><MaskName name={art.student_name} /></div>
                              <div className="text-gray-500 truncate">{art.anomaly_reason}</div>
                              <div className="text-gray-400 mt-1">{art.total_score != null ? `评分: ${art.total_score}` : '评分: -'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">教研结论</h4>
                    <textarea
                      value={conclusions[topic.id] || ''}
                      onChange={e => setConclusions(prev => ({ ...prev, [topic.id]: e.target.value }))}
                      placeholder="记录教研讨论的结论、教学改进方向..."
                      className="w-full border border-gray-300 rounded p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex justify-end mt-2">
                      <button onClick={() => saveConclusion(topic.id)} disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                        {saving ? '保存中...' : '保存结论'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

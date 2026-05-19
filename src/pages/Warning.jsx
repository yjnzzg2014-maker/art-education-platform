import { useEffect, useState } from 'react'
import StatCard from '../components/StatCard'
import ReviewModal from '../components/ReviewModal'
import client from '../api/client'
import MaskName from '../components/MaskName'

export default function Warning() {
  const [anomalies, setAnomalies] = useState([])
  const [filter, setFilter] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [reviewTarget, setReviewTarget] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await client.get('/artworks/anomalies')
      setAnomalies(data)
    } catch (err) {
      console.error('Failed to load anomalies:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleReviewSubmit = async ({ comment, override }) => {
    if (!reviewTarget) return
    try {
      await client.post(`/artworks/${reviewTarget.id}/review`, { comment, override })
      setAnomalies(prev => prev.map(a => a.id === reviewTarget.id ? { ...a, is_anomaly: 0 } : a))
    } catch (err) {
      console.error('Failed to review artwork:', err)
    }
    setReviewTarget(null)
  }

  const filteredAnomalies = anomalies.filter(a => {
    if (filter === '全部') return true
    if (filter === '黑色占比') return a.anomaly_reason?.includes('黑色占比') || a.anomaly_reason?.includes('深色')
    if (filter === '主题偏离') return a.anomaly_reason?.includes('主题') || a.anomaly_reason?.includes('匹配度')
    return true
  })

  const totalAnomalies = anomalies.length
  const pendingReview = anomalies.filter(a => a.is_anomaly === 1).length
  const reviewed = anomalies.filter(a => a.is_anomaly === 0).length

  const anomalyTypes = ['全部', '黑色占比', '主题偏离']

  if (loading) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-2">异常发展预警</div>
        <h1 className="text-xl font-bold">异常发展预警</h1>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="异常作品总数" value={totalAnomalies} unit="幅" trend="" trendType="neutral" />
        <StatCard label="待审核" value={pendingReview} unit="幅" trend="需尽快处理" trendType="warn" />
        <StatCard label="已审核" value={reviewed} unit="幅" trend="已转入正常队列" trendType="up" />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold">异常作品列表</h2>
          <div className="flex gap-1">
            {anomalyTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 text-xs rounded ${filter === type ? 'bg-blue-100 text-blue-600 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {type} ({type === '全部' ? anomalies.length : anomalies.filter(a => {
                  if (type === '黑色占比') return a.anomaly_reason?.includes('黑色占比') || a.anomaly_reason?.includes('深色')
                  if (type === '主题偏离') return a.anomaly_reason?.includes('主题') || a.anomaly_reason?.includes('匹配度')
                  return false
                }).length})
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3 font-medium">作品</th>
                <th className="px-4 py-3 font-medium">学生信息</th>
                <th className="px-4 py-3 font-medium">异常原因</th>
                <th className="px-4 py-3 font-medium">评分</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAnomalies.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500">暂无异常作品</td>
                </tr>
              ) : (
                filteredAnomalies.map(artwork => (
                  <tr key={artwork.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="w-16 h-16 rounded overflow-hidden bg-gray-100">
                        {artwork.image_url ? (
                          <img src={artwork.image_url} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">无图片</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MaskName name={artwork.student_name} />
                      <div className="text-xs text-gray-500">{artwork.class_name || '未知班级'}</div>
                      {artwork.task_name && <div className="text-xs text-gray-400">{artwork.task_name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        {artwork.anomaly_reason || '未说明'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{artwork.total_score != null ? `${artwork.total_score}分` : '-'}</div>
                      <div className="text-xs text-gray-500">{artwork.grade ? `评级: ${artwork.grade}` : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      {artwork.is_anomaly === 1 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">待审核</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">已审核</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {artwork.is_anomaly === 1 && (
                        <button
                          onClick={() => setReviewTarget(artwork)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          标记已审核
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reviewTarget && (
        <ReviewModal
          artworkId={reviewTarget.id}
          studentName={reviewTarget.student_name}
          onSubmit={handleReviewSubmit}
          onClose={() => setReviewTarget(null)}
        />
      )}
    </div>
  )
}

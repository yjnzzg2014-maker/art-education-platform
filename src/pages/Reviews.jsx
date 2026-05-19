import { useEffect, useState } from 'react'
import client from '../api/client'
import MaskName from '../components/MaskName'
import StatCard from '../components/StatCard'

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [allReviews, setAllReviews] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReviews()
  }, [])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const { data } = await client.get('/artworks/reviews')
      setAllReviews(data)
      setReviews(data)
      // Extract unique teachers from reviews
      const uniqueTeachers = []
      const seen = new Set()
      data.forEach(r => {
        if (!seen.has(r.teacher_id)) {
          seen.add(r.teacher_id)
          uniqueTeachers.push({ id: r.teacher_id, name: r.teacher_name })
        }
      })
      setTeachers(uniqueTeachers)
    } catch (err) {
      console.error('Failed to load reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedTeacher) {
      setReviews(allReviews.filter(r => r.teacher_id.toString() === selectedTeacher))
    } else {
      setReviews(allReviews)
    }
  }, [selectedTeacher, allReviews])

  // Calculate stats
  const totalReviews = reviews.length
  const thisMonth = reviews.filter(r => {
    const date = new Date(r.created_at)
    const now = new Date()
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }).length
  const overrideCount = reviews.filter(r => r.override).length

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && reviews.length === 0) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">教师释义记录</h1>
        <p className="text-gray-500 text-sm mt-1">查看所有教师的释义复核记录</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="总释义记录" value={totalReviews} unit="条" />
        <StatCard label="本月释义" value={thisMonth} unit="条" />
        <StatCard label="Override 记录" value={overrideCount} unit="条" />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-600">筛选教师：</label>
        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">全部教师</option>
          {teachers.map(teacher => (
            <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
          ))}
        </select>
        {selectedTeacher && (
          <button
            onClick={() => setSelectedTeacher('')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            清除筛选
          </button>
        )}
      </div>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white border border-gray-200 rounded-lg">
            暂无释义记录
          </div>
        ) : (
          reviews.map(review => (
            <div
              key={review.id}
              className="bg-white border border-gray-200 rounded-lg p-4 border-l-4 border-l-green-500 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                {review.image_url && (
                  <img
                    src={review.image_url}
                    alt={review.artwork_title}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {review.artwork_title || '作品释义'}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        <MaskName name={review.student_name} /> · {review.class_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        释义教师：{review.teacher_name}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {review.override === 1 && (
                        <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                          Override
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded p-3">
                    {review.comment}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

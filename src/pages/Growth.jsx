import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import client from '../api/client'
import MaskName from '../components/MaskName'

export default function Growth() {
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [worksLoading, setWorksLoading] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [])

  useEffect(() => {
    if (selectedStudent) {
      fetchWorks(selectedStudent.id)
    }
  }, [selectedStudent])

  async function fetchStudents() {
    try {
      const res = await client.get('/students')
      const studentList = res.data.data || res.data
      setStudents(studentList)
      if (studentList.length > 0) {
        setSelectedStudent(studentList[0])
      }
    } catch (err) {
      console.error('Failed to fetch students:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchWorks(studentId) {
    setWorksLoading(true)
    try {
      const res = await client.get(`/students/${studentId}/works`)
      setWorks(res.data)
    } catch (err) {
      console.error('Failed to fetch works:', err)
      setWorks([])
    } finally {
      setWorksLoading(false)
    }
  }

  function getGradeBadge(grade) {
    const colors = {
      'A': 'bg-green-100 text-green-800',
      'B': 'bg-blue-100 text-blue-800',
      'C': 'bg-yellow-100 text-yellow-800',
      'D': 'bg-red-100 text-red-800',
    }
    return colors[grade] || 'bg-gray-100 text-gray-800'
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  // Prepare chart data sorted by date
  const chartData = [...works]
    .sort((a, b) => new Date(a.upload_time) - new Date(b.upload_time))
    .map(work => ({
      date: formatDate(work.upload_time),
      score: work.total_score,
    }))

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold">纵向成长追踪</h1>
      </div>

      <div className="flex h-[calc(100vh-200px)]">
        {/* Left Sidebar - Student List */}
        <aside className="w-1/4 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">学生列表</h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500">加载中...</div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">暂无学生</div>
            ) : (
              <ul className="space-y-1">
                {students.map(student => (
                  <li key={student.id}>
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedStudent?.id === student.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="font-medium"><MaskName name={student.name} /></div>
                      <div className="text-sm text-gray-500">{student.class_name || '未分班'}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right Panel - Growth Data */}
        <main className="flex-1 overflow-y-auto">
          {selectedStudent ? (
            <div className="p-6">
              {/* Student Info Header */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-indigo-600">
                      {selectedStudent.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900"><MaskName name={selectedStudent.name} /></h2>
                    <p className="text-gray-500">{selectedStudent.class_name || '未分班'}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      共 {works.length} 件作品
                    </p>
                  </div>
                </div>
              </div>

              {/* Score Trend Chart */}
              {chartData.length > 1 && (
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">分数趋势</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis
                          dataKey="date"
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ fill: '#6366f1', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Artwork Timeline */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">作品时间线</h3>
                {worksLoading ? (
                  <div className="text-center py-8 text-gray-500">加载作品...</div>
                ) : works.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">暂无作品</div>
                ) : (
                  <div className="space-y-4">
                    {[...works]
                      .sort((a, b) => new Date(b.upload_time) - new Date(a.upload_time))
                      .map(work => (
                        <div
                          key={work.id}
                          className="flex gap-4 p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                            {work.image_url ? (
                              <img
                                src={work.image_url}
                                alt={work.title}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                暂无图片
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-medium text-gray-900">{work.title}</h4>
                                {work.theme && (
                                  <p className="text-sm text-gray-500">主题: {work.theme}</p>
                                )}
                              </div>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getGradeBadge(work.grade)}`}>
                                {work.grade || 'N/A'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                              <span>{formatDate(work.upload_time)}</span>
                              {work.total_score !== undefined && work.total_score !== null && (
                                <span className="font-medium text-indigo-600">
                                  评分: {work.total_score}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* View Link */}
                          <Link
                            to={`/students/${selectedStudent.id}`}
                            className="flex-shrink-0 self-center px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            查看详情
                          </Link>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              请选择左侧学生以查看成长数据
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

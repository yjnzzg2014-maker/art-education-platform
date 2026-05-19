import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'
import MaskName from '../components/MaskName'

export default function StudentProfile() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)

  useEffect(() => {
    if (id) {
      client.get(`/students/${id}`).then(({ data }) => setStudent(data)).catch(console.error)
    }
  }, [id])

  if (!id) return <div className="text-gray-500">请从学生列表选择学生</div>
  if (!student) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">学生画像</h1>
        <p className="text-gray-500 text-sm mt-1"><MaskName name={student.name} /> · {student.class_name}</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{student.stats?.total || 0}</div>
          <div className="text-sm text-gray-500">作品总数</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{Math.round(student.stats?.avgScore || 0)}</div>
          <div className="text-sm text-gray-500">平均分</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{(() => {
            const s = student.stats
            if (!s) return '-'
            const grades = { A: s.gradeA || 0, B: s.gradeB || 0, C: s.gradeC || 0, D: s.gradeD || 0 }
            return Object.entries(grades).sort((a, b) => b[1] - a[1])[0][0]
          })()}</div>
          <div className="text-sm text-gray-500">主要评级</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{student.artworks?.length || 0}</div>
          <div className="text-sm text-gray-500">历史记录</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold">历史作品</h2>
        </div>
        <div className="p-4 grid grid-cols-6 gap-3">
          {student.artworks?.map(art => (
            <div key={art.id} className="border border-gray-200 rounded overflow-hidden">
              <div className="h-20 bg-gray-100">
                {art.image_url ? (
                  <img src={art.image_url} alt={art.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100" />
                )}
              </div>
              <div className="p-2 text-xs">
                <div className="font-medium truncate">{art.title}</div>
                <div className="text-gray-500">{art.total_score != null ? `${art.total_score}分 · ` : ''}{art.grade || '-'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'
import MaskName from '../components/MaskName'

export default function StudentProfile() {
  const { id } = useParams()
  const [student, setStudent] = useState(null)
  const [selectedTheme, setSelectedTheme] = useState('全部')

  useEffect(() => {
    if (id) {
      client.get(`/students/${id}`).then(({ data }) => setStudent(data)).catch(console.error)
    }
  }, [id])

  // 获取学生的所有主题列表
  const themes = useMemo(() => {
    if (!student?.artworks) return []
    const themeSet = new Set(student.artworks.map(a => a.task_name || a.theme || '未分类'))
    return ['全部', ...Array.from(themeSet)]
  }, [student?.artworks])

  // 按主题筛选作品
  const filteredArtworks = useMemo(() => {
    if (!student?.artworks) return []
    if (selectedTheme === '全部') return student.artworks
    return student.artworks.filter(a => (a.task_name || a.theme || '未分类') === selectedTheme)
  }, [student?.artworks, selectedTheme])

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
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-3">
          <h2 className="font-semibold">历史作品</h2>
          {/* 主题筛选标签栏 */}
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-[70%]">
            {themes.map(theme => (
              <button
                key={theme}
                onClick={() => setSelectedTheme(theme)}
                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  selectedTheme === theme
                    ? 'bg-blue-100 text-blue-600 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 grid grid-cols-6 gap-3">
          {filteredArtworks.length === 0 ? (
            <div className="col-span-6 text-center text-gray-400 py-8">暂无作品</div>
          ) : (
            filteredArtworks.map(art => (
              <div key={art.id} className="border border-gray-200 rounded overflow-hidden">
                <div className="h-20 bg-gray-100">
                  {art.image_url ? (
                    <img src={art.image_url} alt={art.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100" />
                  )}
                </div>
                <div className="p-2 text-xs">
                  <div className="font-medium truncate">{art.title || art.task_name || art.theme || '未分类'}</div>
                  <div className="text-gray-500">{art.total_score != null ? `${art.total_score}分 · ` : ''}{art.grade || '-'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

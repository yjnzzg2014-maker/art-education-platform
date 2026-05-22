import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import MaskName from '../components/MaskName'
import StatCard from '../components/StatCard'

export default function Students() {
  const [students, setStudents] = useState([])
  const [grades, setGrades] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFilters()
  }, [])

  useEffect(() => {
    loadStudents()
  }, [selectedGrade, selectedClass])

  async function loadFilters() {
    try {
      const [gradesRes, classesRes] = await Promise.all([
        client.get('/grades'),
        client.get('/classes'),
      ])
      setGrades(gradesRes.data || [])
      setClasses(classesRes.data || [])
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
  }

  async function loadStudents() {
    try {
      setLoading(true)
      const params = { limit: 2000 }
      if (selectedClass) params.classId = selectedClass
      const { data } = await client.get('/students', { params })
      const studentList = data.data || []

      let filtered = studentList
      if (selectedGrade) {
        const gradeClassIds = classes.filter(c => c.grade_id === Number(selectedGrade)).map(c => c.id)
        filtered = filtered.filter(s => gradeClassIds.includes(s.class_id))
      }

      setStudents(filtered)
    } catch (err) {
      console.error('Failed to load students:', err)
    } finally {
      setLoading(false)
    }
  }

  // 年级班级分组
  const groupedByClass = students.reduce((acc, s) => {
    const key = `${s.grade_name || ''}-${s.class_name || ''}`
    if (!acc[key]) acc[key] = { grade: s.grade_name, className: s.class_name, classId: s.class_id, students: [] }
    acc[key].students.push(s)
    return acc
  }, {})

  const classGroups = Object.values(groupedByClass).sort((a, b) => {
    if (a.grade !== b.grade) return (a.grade || '').localeCompare(b.grade || '')
    return (a.className || '').localeCompare(b.className || '')
  })

  // 统计
  const gradeDist = { A: 0, B: 0, C: 0, D: 0 }
  const gradeToNum = { A: 4, B: 3, C: 2, D: 1 }
  const gradeNumToLetter = { 4: 'A', 3: 'B', 2: 'C', 1: 'D' }
  let totalScore = 0, scoredCount = 0

  students.forEach(s => {
    if (s.latest_grade in gradeDist) gradeDist[s.latest_grade]++
    if (s.latest_score != null) { totalScore += s.latest_score; scoredCount++ }
  })

  const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : '-'
  const avgGradeNum = scoredCount > 0
    ? gradeNumToLetter[Math.round(Object.entries(gradeDist).reduce((sum, [g, cnt]) => sum + gradeToNum[g] * cnt, 0) / scoredCount)] || '-'
    : '-'

  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }
  const gradeTextColors = { A: 'text-green-600', B: 'text-blue-600', C: 'text-amber-600', D: 'text-red-600' }
  const gradeBgColors = { A: 'bg-green-50', B: 'bg-blue-50', C: 'bg-amber-50', D: 'bg-red-50' }

  if (loading) return <div className="text-gray-500 p-8 text-center">加载中...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">学生素养画像</h1>
        <p className="text-gray-500 text-sm mt-1">查看各班级学生素养评级与关注情况</p>
      </div>

      {/* 顶部统计 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="学生总数" value={students.length} unit="人" />
        <StatCard label="班级数量" value={classGroups.length} unit="个" />
        <StatCard label="平均评分" value={avgScore} unit="分" />
      </div>

      {/* 等级分布 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">素养评级分布</div>
        <div className="flex gap-6">
          {['A', 'B', 'C', 'D'].map(g => {
            const cnt = gradeDist[g]
            const pct = students.length > 0 ? Math.round(cnt / students.length * 100) : 0
            return (
              <div key={g} className={`flex-1 rounded-lg p-3 ${gradeBgColors[g]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-7 h-7 rounded flex items-center justify-center text-white text-sm font-bold ${gradeColors[g]}`}>{g}</span>
                  <span className="text-sm text-gray-500">{pct}%</span>
                </div>
                <div className={`text-xl font-bold ${gradeTextColors[g]}`}>{cnt} 人</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-600">年级：</label>
        <select
          value={selectedGrade}
          onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass('') }}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部年级</option>
          {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <label className="text-sm text-gray-600">班级：</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全部班级</option>
          {classes.filter(c => !selectedGrade || c.grade_id === Number(selectedGrade)).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <span className="ml-auto text-sm text-gray-500">共 {students.length} 名学生 / {classGroups.length} 个班级</span>
      </div>

      {/* 班级卡片列表 */}
      <div className="space-y-4">
        {classGroups.map(group => {
          const classGradeDist = { A: 0, B: 0, C: 0, D: 0 }
          let classTotal = 0, classScored = 0
          group.students.forEach(s => {
            if (s.latest_grade in classGradeDist) classGradeDist[s.latest_grade]++
            if (s.latest_score != null) { classTotal += s.latest_score; classScored++ }
          })
          const classAvg = classScored > 0 ? (classTotal / classScored).toFixed(1) : '-'
          const anomalyCount = group.students.filter(s => s.has_anomaly).length

          return (
            <div key={`${group.grade}-${group.className}`} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* 班级表头 */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-800">{group.grade} {group.className}</span>
                  <span className="text-sm text-gray-500">{group.students.length} 人</span>
                  {anomalyCount > 0 && (
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">
                      关注 {anomalyCount} 人
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">班级均分</span>
                  <span className="font-semibold text-blue-600">{classAvg}</span>
                  <div className="flex items-center gap-1.5">
                    {['A', 'B', 'C', 'D'].map(g => (
                      <span key={g} className={`w-6 h-6 rounded flex items-center justify-center text-xs font-medium text-white ${gradeColors[g]}`}>
                        {classGradeDist[g]}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/students?classId=${group.classId}`}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    查看详情 →
                  </Link>
                </div>
              </div>

              {/* 学生列表（缩略展示） */}
              <div className="flex flex-wrap gap-2 px-4 py-3">
                {group.students.map(s => (
                  <Link
                    key={s.id}
                    to={`/students/${s.id}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700"><MaskName name={s.name} /></span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${gradeColors[s.latest_grade] || 'bg-gray-400'}`}>
                      {s.latest_grade || 'N'}
                    </span>
                    {s.has_anomaly && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {classGroups.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          暂无学生数据
        </div>
      )}
    </div>
  )
}

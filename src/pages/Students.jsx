import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import MaskName from '../components/MaskName'
import StatCard from '../components/StatCard'

export default function Students() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      setLoading(true)
      const { data } = await client.get('/students')
      const studentList = data.data || data
      setStudents(studentList)
      const uniqueClasses = [...new Set(studentList.map(s => s.class_name).filter(Boolean))]
      setClasses(uniqueClasses)
    } catch (err) {
      console.error('Failed to load students:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = selectedClass
    ? students.filter(s => s.class_name === selectedClass)
    : students

  // Calculate stats
  const totalStudents = filteredStudents.length
  const totalClasses = classes.length
  const gradeToNum = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 }
  const avgGradeNum = filteredStudents.length > 0
    ? filteredStudents.reduce((sum, s) => sum + (gradeToNum[s.latest_grade] || 0), 0) / filteredStudents.length
    : 0
  const gradeNumToLetter = { 4: 'A', 3: 'B', 2: 'C', 1: 'D' }
  const avgGrade = avgGradeNum > 0 ? gradeNumToLetter[Math.round(avgGradeNum)] || '-' : '-'

  const getGradeBadge = (grade) => {
    const colors = {
      A: 'bg-green-100 text-green-700',
      B: 'bg-blue-100 text-blue-700',
      C: 'bg-amber-100 text-amber-700',
      D: 'bg-red-100 text-red-700'
    }
    return colors[grade] || 'bg-gray-100 text-gray-700'
  }

  if (loading) return <div className="text-gray-500">加载中...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">学生素养画像</h1>
        <p className="text-gray-500 text-sm mt-1">查看所有学生的素养评级与异常情况</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="学生总数" value={totalStudents} unit="人" />
        <StatCard label="班级数量" value={totalClasses} unit="个" />
        <StatCard label="平均评级" value={avgGrade} unit="分" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">筛选班级：</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部班级</option>
            {classes.map(cls => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
        <span className="text-sm text-gray-500">共 {filteredStudents.length} 名学生</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {filteredStudents.map(student => (
          <Link
            key={student.id}
            to={`/students/${student.id}`}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-medium text-blue-600">
                  {student.name?.charAt(0) || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate"><MaskName name={student.name} /></div>
                <div className="text-xs text-gray-500 mt-0.5">{student.student_no}</div>
                <div className="text-xs text-gray-500">{student.class_name}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className={`px-2 py-0.5 text-xs rounded ${getGradeBadge(student.latest_grade)}`}>
                {student.latest_grade || 'N/A'}
              </span>
              {student.has_anomaly && (
                <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">
                  异常
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filteredStudents.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          暂无学生数据
        </div>
      )}
    </div>
  )
}

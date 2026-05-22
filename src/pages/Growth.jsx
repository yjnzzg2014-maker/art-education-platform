import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import client from '../api/client'
import { useAuthStore } from '../stores/authStore'
import MaskName from '../components/MaskName'
import StatCard from '../components/StatCard'

export default function Growth() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [searchParams] = useSearchParams()
  const initStudentId = searchParams.get('studentId') ? Number(searchParams.get('studentId')) : null

  const [grades, setGrades] = useState([])
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [works, setWorks] = useState([])
  const [loading, setLoading] = useState(true)
  const [worksLoading, setWorksLoading] = useState(false)

  const [gradeFilter, setGradeFilter] = useState('')

  useEffect(() => { fetchFilters() }, [])

  useEffect(() => {
    fetchStudents()
    setSelectedClassId(null)
    setSelectedStudent(null)
  }, [gradeFilter])

  async function fetchFilters() {
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

  async function fetchStudents() {
    try {
      setLoading(true)
      const params = { limit: 2000 }
      const res = await client.get('/students', { params })
      let studentList = (res.data.data || [])

      // 年级过滤
      if (gradeFilter) {
        const gradeClassIds = classes.filter(c => c.grade_id === Number(gradeFilter)).map(c => c.id)
        studentList = studentList.filter(s => gradeClassIds.includes(s.class_id))
      }

      // 教师只能看自己班级
      if (!isAdmin) {
        const myClassIds = classes.filter(c => c.teacher_ids?.includes(user.id)).map(c => c.id)
        studentList = studentList.filter(s => myClassIds.includes(s.class_id))
      }

      setStudents(studentList)

      // 如果 URL 有 studentId 参数，自动选中该学生及对应班级
      if (initStudentId) {
        const target = studentList.find(s => s.id === initStudentId)
        if (target) {
          setSelectedClassId(target.class_id)
          setSelectedStudent(target)
          fetchWorks(target.id)
        }
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
      setWorks(res.data || [])
    } catch (err) {
      console.error('Failed to fetch works:', err)
      setWorks([])
    } finally {
      setWorksLoading(false)
    }
  }

  // 按班级分组
  const groupedByClass = students.reduce((acc, s) => {
    if (!acc[s.class_id]) {
      acc[s.class_id] = {
        classId: s.class_id,
        gradeName: s.grade_name,
        className: s.class_name,
        students: [],
      }
    }
    acc[s.class_id].students.push(s)
    return acc
  }, {})

  const classGroups = Object.values(groupedByClass).sort((a, b) => {
    if (a.gradeName !== b.gradeName) return (a.gradeName || '').localeCompare(b.gradeName || '')
    return (a.className || '').localeCompare(b.className || '')
  })

  const selectedClass = selectedClassId ? classGroups.find(g => g.classId === selectedClassId) : null

  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }
  const gradeBgColors = { A: 'bg-green-50', B: 'bg-blue-50', C: 'bg-amber-50', D: 'bg-red-50' }
  const gradeTextColors = { A: 'text-green-600', B: 'text-blue-600', C: 'text-amber-600', D: 'text-red-600' }

  function getGradeBadge(grade) {
    return gradeColors[grade] ? `${gradeColors[grade]} text-white` : 'bg-gray-400 text-white'
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  // 根据 upload_time 推断学期：9 月 ~ 次年 1 月 = 秋季学期；2 月 ~ 7 月 = 春季学期
  function getSemester(dateStr) {
    const d = new Date(dateStr)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    if (month >= 9) return { key: `${year}-fall`, label: `${year} 秋季学期`, sort: year * 10 + 1 }
    if (month <= 1) return { key: `${year - 1}-fall`, label: `${year - 1} 秋季学期`, sort: (year - 1) * 10 + 1 }
    return { key: `${year}-spring`, label: `${year} 春季学期`, sort: year * 10 }
  }

  // 选中学生的作品趋势数据
  const chartData = [...works]
    .sort((a, b) => new Date(a.upload_time) - new Date(b.upload_time))
    .map(w => ({ date: formatDate(w.upload_time), score: w.total_score, grade: w.grade }))

  // 按学期分组：用于"跨学期成长档案"时间线
  const worksBySemester = (() => {
    const groups = {}
    works.forEach(w => {
      const s = getSemester(w.upload_time)
      if (!groups[s.key]) groups[s.key] = { ...s, works: [] }
      groups[s.key].works.push(w)
    })
    Object.values(groups).forEach(g => {
      g.works.sort((a, b) => new Date(a.upload_time) - new Date(b.upload_time))
    })
    return Object.values(groups).sort((a, b) => a.sort - b.sort)
  })()

  // 选中班级的所有作品（按时间聚合，用于班级趋势）
  async function handleClassSelect(classId) {
    setSelectedClassId(classId)
    setSelectedStudent(null)
    setWorks([])
  }

  async function handleStudentSelect(student) {
    setSelectedStudent(student)
    await fetchWorks(student.id)
  }

  const filteredClasses = gradeFilter
    ? classes.filter(c => c.grade_id === Number(gradeFilter))
    : classes

  if (loading) return <div className="text-gray-500 p-8 text-center">加载中...</div>

  // 班级视图（未选中具体班级时）
  if (!selectedClass) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold">纵向成长追踪</h1>
          <p className="text-gray-500 text-sm mt-1">追踪各班级学生阶段性成长曲线</p>
        </div>

        {/* 筛选 */}
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm text-gray-600">年级：</label>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部年级</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <span className="ml-auto text-sm text-gray-500">共 {classGroups.length} 个班级</span>
        </div>

        {/* 班级卡片网格 */}
        <div className="grid grid-cols-2 gap-4">
          {classGroups.map(group => (
            <div
              key={group.classId}
              onClick={() => handleClassSelect(group.classId)}
              className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-medium text-gray-800">{group.gradeName} {group.className}</span>
                  <span className="text-sm text-gray-500 ml-2">{group.students.length} 人</span>
                </div>
                <span className="text-blue-600 text-sm">查看 →</span>
              </div>

              {/* 学生头像墙（显示前8个） */}
              <div className="flex flex-wrap gap-1 mb-3">
                {group.students.slice(0, 8).map(s => (
                  <div
                    key={s.id}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center"
                    title={s.name}
                  >
                    <span className="text-xs font-medium text-blue-600">{s.name?.charAt(0)}</span>
                  </div>
                ))}
                {group.students.length > 8 && (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-500">+{group.students.length - 8}</span>
                  </div>
                )}
              </div>

              {/* 等级分布条 */}
              <div className="flex gap-1">
                {['A', 'B', 'C', 'D'].map(g => {
                  const cnt = group.students.filter(s => s.latest_grade === g).length
                  const pct = group.students.length > 0 ? (cnt / group.students.length * 100) : 0
                  return (
                    <div key={g} className="flex-1">
                      <div className={`h-1.5 rounded-full ${gradeColors[g]}`} style={{ width: `${pct}%`, opacity: pct > 0 ? 1 : 0 }}></div>
                      <div className="text-xs text-gray-500 mt-0.5 text-center">{cnt}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {classGroups.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
            暂无班级数据
          </div>
        )}
      </div>
    )
  }

  // 班级内学生视图（已选中班级）
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedClassId(null); setSelectedStudent(null) }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">{selectedClass.gradeName} {selectedClass.className}</h1>
          <span className="text-gray-500">{selectedClass.students.length} 名学生</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部年级</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex h-[calc(100vh-200px)]">
        {/* 左侧：班级学生列表 */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-3">
            <h2 className="text-sm font-medium text-gray-500 mb-2">选择学生查看成长曲线</h2>
            <div className="space-y-1">
              {selectedClass.students.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleStudentSelect(s)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedStudent?.id === s.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">{s.name?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate"><MaskName name={s.name} /></div>
                    <div className="text-xs text-gray-400">{s.student_no}</div>
                  </div>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${getGradeBadge(s.latest_grade)}`}>
                    {s.latest_grade || 'N'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* 右侧：成长曲线 */}
        <main className="flex-1 overflow-y-auto p-6">
          {selectedStudent ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-600">{selectedStudent.name?.charAt(0)}</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900"><MaskName name={selectedStudent.name} /></h2>
                  <p className="text-sm text-gray-500">{selectedStudent.student_no}</p>
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{works.length}</div>
                    <div className="text-xs text-gray-500">作品总数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {works.length > 0 ? (works.reduce((sum, w) => sum + (w.total_score || 0), 0) / works.filter(w => w.total_score != null).length).toFixed(1) : '-'}
                    </div>
                    <div className="text-xs text-gray-500">平均分</div>
                  </div>
                </div>
              </div>

              {/* 成长曲线 */}
              {chartData.length > 1 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">成长曲线</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ fill: '#6366f1', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 按学期分组的成长档案时间线 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">📒 跨学期成长档案</h3>
                {worksBySemester.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无作品记录</p>
                ) : (
                  <div className="space-y-5">
                    {worksBySemester.map(sem => (
                      <div key={sem.key} className="border-l-4 border-blue-300 pl-4 relative">
                        <div className="absolute -left-2 top-0 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-sm font-semibold text-blue-700">{sem.label}</h4>
                          <span className="text-xs text-gray-400">{sem.works.length} 幅作品</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {sem.works.map(w => (
                            <Link
                              key={w.id}
                              to={`/students/${selectedStudent.id}`}
                              className="flex-shrink-0 w-32 bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors"
                            >
                              <div className="w-full aspect-square bg-gray-200 rounded mb-2 overflow-hidden">
                                {w.image_url ? (
                                  <img src={w.image_url} alt={w.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">暂无图片</div>
                                )}
                              </div>
                              <div className="text-xs text-center">
                                <div className="font-medium text-gray-700 truncate">{w.theme || w.title || '无标题'}</div>
                                <div className="text-gray-400">{formatDate(w.upload_time)}</div>
                                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-bold ${getGradeBadge(w.grade)}`}>
                                  {w.grade || 'N'}
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p>请从左侧列表选择学生</p>
                <p className="text-sm mt-1">查看个人成长曲线</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/StatCard'
import ColorChart from '../components/ColorChart'
import DonutChart from '../components/DonutChart'
import client from '../api/client'
import { buildColorDistribution, buildCompositionDistribution, getGradeLetter } from '../utils/analysisHelpers'

export default function Reports() {
  const navigate = useNavigate()
  const [level, setLevel] = useState('school')
  const [schoolId, setSchoolId] = useState(null)
  const [gradeId, setGradeId] = useState(null)
  const [classId, setClassId] = useState(null)

  const [schoolBreakdown, setSchoolBreakdown] = useState([])
  const [gradeBreakdown, setGradeBreakdown] = useState([])
  const [classArtworks, setClassArtworks] = useState([])
  const [classStats, setClassStats] = useState(null)
  const [gradeName, setGradeName] = useState('')
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSchoolData()
  }, [])

  const loadSchoolData = async () => {
    try {
      setLoading(true)
      const { data: tasks } = await client.get('/tasks')
      if (tasks.length > 0) {
        const task = tasks[0]
        const { data: taskDetail } = await client.get(`/tasks/${task.id}`)
        const sid = taskDetail.school_id
        setSchoolId(sid)

        const { data: breakdown } = await client.get(`/stats/school/${sid}/breakdown`)
        setSchoolBreakdown(breakdown)
      }
    } catch (err) {
      console.error('Failed to load school data:', err)
    } finally {
      setLoading(false)
    }
  }

  const drillToGrade = async (gid, gname) => {
    setLevel('grade')
    setGradeId(gid)
    setGradeName(gname)
    setLoading(true)
    try {
      const { data: breakdown } = await client.get(`/stats/grade/${gid}/breakdown`)
      setGradeBreakdown(breakdown)
    } catch (err) {
      console.error('Failed to load grade data:', err)
    } finally {
      setLoading(false)
    }
  }

  const drillToClass = async (cid, cname) => {
    setLevel('class')
    setClassId(cid)
    setClassName(cname)
    setLoading(true)
    try {
      const { data: tasks } = await client.get('/tasks')
      const task = tasks.find(t => t.class_id === cid)
      if (task) {
        const { data: stats } = await client.get(`/stats/class/${cid}`)
        setClassStats(stats)
        const { data: artworks } = await client.get(`/artworks?taskId=${task.id}`)
        setClassArtworks(artworks)
      }
    } catch (err) {
      console.error('Failed to load class data:', err)
    } finally {
      setLoading(false)
    }
  }

  const goUp = () => {
    if (level === 'class') {
      setLevel('grade')
      setClassName('')
      loadGradeData(gradeId)
    } else if (level === 'grade') {
      setLevel('school')
      setGradeName('')
    }
  }

  const loadGradeData = async (gid) => {
    setLoading(true)
    try {
      const { data: breakdown } = await client.get(`/stats/grade/${gid}/breakdown`)
      setGradeBreakdown(breakdown)
    } catch (err) {
      console.error('Failed to load grade data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-gray-500">加载中...</div>

  const breadcrumbs = [
    { label: '学校', active: level === 'school', onClick: () => { setLevel('school'); setGradeName(''); setClassName('') } },
  ]
  if (level === 'grade' || level === 'class') {
    breadcrumbs.push({ label: gradeName, active: level === 'grade', onClick: goUp })
  }
  if (level === 'class') {
    breadcrumbs.push({ label: className, active: true, onClick: () => {} })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          {breadcrumbs.map((b, i) => (
            <span key={i}>
              {i > 0 && ' / '}
              <span className={`cursor-pointer hover:text-blue-600 ${b.active ? 'font-medium text-gray-900' : ''}`}
                onClick={b.onClick}>{b.label}</span>
            </span>
          ))}
        </div>
        <h1 className="text-xl font-bold">数据看板</h1>
      </div>

      {/* School level */}
      {level === 'school' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="年级数" value={schoolBreakdown.length} unit="个" />
            <StatCard label="班级数" value={schoolBreakdown.reduce((s, g) => s + (g.classCount || 0), 0)} unit="个" />
            <StatCard label="学生总数" value={schoolBreakdown.reduce((s, g) => s + (g.studentCount || 0), 0)} unit="人" />
            <StatCard label="作品总数" value={schoolBreakdown.reduce((s, g) => s + (g.artworkCount || 0), 0)} unit="幅" />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold">各年级统计</h2>
              <p className="text-xs text-gray-400 mt-1">点击年级可查看下级班级明细</p>
            </div>
            <div className="p-4">
              {schoolBreakdown.length === 0 ? (
                <div className="text-center text-gray-500 py-8">暂无数据</div>
              ) : (
                schoolBreakdown.map(g => (
                  <div key={g.id}
                    onClick={() => drillToGrade(g.id, g.name)}
                    className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors">
                    <div>
                      <div className="font-medium">{g.name}</div>
                      <div className="text-sm text-gray-500">{g.classCount || 0} 个班 · {g.studentCount || 0} 名学生 · {g.artworkCount || 0} 幅作品</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{getGradeLetter(g.avgScore || 0)}</div>
                        <div className="text-xs text-gray-400">{Math.round(g.avgScore || 0)}</div>
                      </div>
                      <div className="flex gap-1">
                        {['A','B','C','D'].map(l => (
                          <span key={l} className={`text-xs px-1.5 py-0.5 rounded ${
                            l === 'A' ? 'bg-green-100 text-green-700' :
                            l === 'B' ? 'bg-blue-100 text-blue-700' :
                            l === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {l}:{g[`grade${l}`] || 0}
                          </span>
                        ))}
                      </div>
                      <span className="text-gray-400">›</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Grade level */}
      {level === 'grade' && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="班级数" value={gradeBreakdown.length} unit="个" />
            <StatCard label="学生总数" value={gradeBreakdown.reduce((s, c) => s + (c.studentCount || 0), 0)} unit="人" />
            <StatCard label="作品总数" value={gradeBreakdown.reduce((s, c) => s + (c.artworkCount || 0), 0)} unit="幅" />
            <StatCard label="关注作品" value={gradeBreakdown.reduce((s, c) => s + (c.anomalyCount || 0), 0)} unit="幅" trend="需释义" trendType="warn" />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold">{selectedName} · 各班级统计</h2>
              <p className="text-xs text-gray-400 mt-1">点击班级查看详细作品数据</p>
            </div>
            <div className="p-4">
              {gradeBreakdown.length === 0 ? (
                <div className="text-center text-gray-500 py-8">暂无数据</div>
              ) : (
                gradeBreakdown.map(c => (
                  <div key={c.id}
                    onClick={() => drillToClass(c.id, c.name)}
                    className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm text-gray-500">{c.studentCount || 0} 名学生 · {c.artworkCount || 0} 幅作品</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">{getGradeLetter(c.avgScore || 0)}</div>
                        <div className="text-xs text-gray-400">均 {Math.round(c.avgScore || 0)}</div>
                      </div>
                      <div className="flex gap-1">
                        {['A','B','C','D'].map(l => (
                          <span key={l} className={`text-xs px-1.5 py-0.5 rounded ${
                            l === 'A' ? 'bg-green-100 text-green-700' :
                            l === 'B' ? 'bg-blue-100 text-blue-700' :
                            l === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {l}:{c[`grade${l}`] || 0}
                          </span>
                        ))}
                      </div>
                      {c.anomalyCount > 0 && (
                        <span className="text-xs text-amber-600">⚠{c.anomalyCount}</span>
                      )}
                      <span className="text-gray-400">›</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Class level */}
      {level === 'class' && classStats && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="作品总数" value={classStats.total || 0} unit="幅" />
            <StatCard label="平均评级" value={getGradeLetter(classStats.avgScore || 0)} unit={`（${Math.round(classStats.avgScore || 0)}）`} />
            <StatCard label="A级作品" value={classStats.gradeA || 0} unit="幅" trend={`${classStats.total ? Math.round(classStats.gradeA / classStats.total * 100) : 0}%`} trendType="up" />
            <StatCard label="关注作品" value={classStats.anomalyCount || 0} unit="幅" trend="需释义" trendType="warn" />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-600 mb-3">评级分布</div>
              <div className="flex items-end gap-1 h-32">
                {['A','B','C','D'].map(l => (
                  <div key={l} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className="text-xs text-gray-500 mb-1">{classStats[`grade${l}`] || 0}</div>
                    <div className={`w-full rounded-t ${
                      l === 'A' ? 'bg-green-500' : l === 'B' ? 'bg-blue-500' : l === 'C' ? 'bg-amber-500' : 'bg-red-500'
                    }`} style={{ height: `${classStats.total ? (classStats[`grade${l}`] || 0) / classStats.total * 100 : 0}%`, minHeight: classStats[`grade${l}`] > 0 ? 4 : 0 }} />
                    <div className="text-xs mt-1 font-medium">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-600 mb-3">色彩分布</div>
              <ColorChart data={buildColorDistribution(classArtworks)} />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-600 mb-3">构图类型</div>
              <DonutChart data={buildCompositionDistribution(classArtworks)} />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/analysis?classId=${classId}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              查看详细分析报告
            </button>
          </div>
        </>
      )}

      {/* No data fallback for class level */}
      {level === 'class' && !classStats && (
        <div className="text-center text-gray-500 py-12">该班级暂无作品数据</div>
      )}

      {/* Footer */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>平台使用守则：</strong>本系统输出为<strong>描述性数据</strong>，不构成对学生的<strong>评价性结论</strong>。所有教学决策必须经过"教师释义"环节，方可进入"协同评研"。
      </div>
    </div>
  )
}

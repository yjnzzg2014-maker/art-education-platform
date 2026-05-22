import { useEffect, useState } from 'react'
import client from '../api/client'
import MaskName from '../components/MaskName'

const WORKFLOW = [
  {
    key: 'data',
    num: '01',
    title: '数据透视',
    sub: '从批量分析中识别值得讨论的作品',
    desc: 'AI 标记关注作品 · 跨班级横向对比',
    color: '#4DABF7',
    bg: 'from-blue-50 to-blue-100/40',
    icon: '🔍',
  },
  {
    key: 'topic',
    num: '02',
    title: '议题聚焦',
    sub: '以课题为单位组织教研讨论',
    desc: '主题归集 · 多班级数据并列呈现',
    color: '#FFA94D',
    bg: 'from-amber-50 to-orange-100/40',
    icon: '🎯',
  },
  {
    key: 'review',
    num: '03',
    title: '教师释义',
    sub: '教师对典型作品给出专业解读',
    desc: '人工判断为锚 · 沉淀教学语言',
    color: '#B197FC',
    bg: 'from-violet-50 to-purple-100/40',
    icon: '💬',
  },
  {
    key: 'conclude',
    num: '04',
    title: '教研沉淀',
    sub: '结论与教学参考进入校本资源库',
    desc: '可复用 · 可检索 · 可传承',
    color: '#69DB7C',
    bg: 'from-emerald-50 to-green-100/40',
    icon: '📚',
  },
]

export default function Research() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedTheme, setExpandedTheme] = useState(null)
  const [expandedArtworks, setExpandedArtworks] = useState([])
  const [conclusions, setConclusions] = useState({})
  const [saving, setSaving] = useState(false)
  const [generatingRef, setGeneratingRef] = useState(null)
  const [teachingRef, setTeachingRef] = useState(null)
  const [tab, setTab] = useState('topics') // 'topics' | 'library'
  const [reviews, setReviews] = useState([])
  const [libraryExpanded, setLibraryExpanded] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [{ data: topicsData }, { data: reviewsData }] = await Promise.all([
        client.get('/research'),
        client.get('/artworks/reviews').catch(() => ({ data: [] }))
      ])

      setTopics(topicsData || [])
      setReviews(reviewsData || [])

      const initConclusions = {}
      topicsData.forEach(t => {
        initConclusions[t.theme] = t.research_conclusion || ''
      })
      setConclusions(initConclusions)
    } catch (err) {
      console.error('Failed to load research topics:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = async (theme) => {
    if (expandedTheme === theme) {
      setExpandedTheme(null)
      setExpandedArtworks([])
      return
    }
    setExpandedTheme(theme)
    try {
      const { data } = await client.get(`/research/${encodeURIComponent(theme)}/anomaly-artworks`)
      setExpandedArtworks(data || [])
    } catch (err) {
      console.error('Failed to load anomaly artworks:', err)
      setExpandedArtworks([])
    }
  }

  const saveConclusion = async (theme) => {
    setSaving(true)
    try {
      await client.patch(`/research/${encodeURIComponent(theme)}`, {
        research_conclusion: conclusions[theme] || ''
      })
    } catch (err) {
      console.error('Failed to save conclusion:', err)
    } finally {
      setSaving(false)
    }
  }

  const generateTeachingRef = async (theme) => {
    setGeneratingRef(theme)
    try {
      const { data } = await client.post(`/research/${encodeURIComponent(theme)}/teaching-reference`)
      setTeachingRef(data?.teaching_reference || { content: '生成失败，请重试' })
    } catch (err) {
      console.error('Failed to generate teaching reference:', err)
    } finally {
      setGeneratingRef(null)
    }
  }

  function getClosureStatus(anomalyCount, reviewedCount) {
    if (anomalyCount === 0) return { label: '已完成', color: 'green', desc: '无关注作品' }
    if (reviewedCount === 0) return { label: '未开始', color: 'red', desc: '待教师释义' }
    if (reviewedCount >= anomalyCount) return { label: '已完成', color: 'green', desc: '全部已释义' }
    return { label: '进行中', color: 'amber', desc: `部分已释义(${reviewedCount}/${anomalyCount})` }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  // 校本资源库：按主题聚合跨班级、跨时间的沉淀
  const libraryByTheme = (() => {
    const groups = {}
    topics.forEach(t => {
      if (!groups[t.theme]) {
        groups[t.theme] = { theme: t.theme, conclusions: [], reviews: [], taskIds: [] }
      }
      if (t.research_conclusion?.trim()) {
        groups[t.theme].conclusions.push({ text: t.research_conclusion, date: t.updated_at })
      }
    })
    reviews.forEach(r => {
      const tk = r.task_theme || r.theme
      if (tk && groups[tk]) {
        if (!groups[tk].reviews) groups[tk].reviews = []
        groups[tk].reviews.push(r)
      }
    })
    return Object.values(groups).sort((a, b) => (b.reviews.length + b.conclusions.length) - (a.reviews.length + a.conclusions.length))
  })()

  const toggleLibrary = (theme) => {
    setLibraryExpanded(prev => ({ ...prev, [theme]: !prev[theme] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        加载教研议题…
      </div>
    )
  }

  const totalAnomaly = topics.reduce((s, t) => s + (t.anomaly_count || 0), 0)
  const totalReviewed = topics.reduce((s, t) => s + (t.reviewed_count || 0), 0)
  const completedCount = topics.filter(t => (t.closure_status?.label || getClosureStatus(t.anomaly_count || 0, t.reviewed_count || 0).label) === '已完成').length
  const inProgressCount = topics.length - completedCount
  const completionRate = totalAnomaly > 0 ? Math.round((totalReviewed / totalAnomaly) * 100) : 0

  return (
    <div>
      {/* Hero：教研方法论 + 工作流 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white px-7 py-6 mb-6 shadow-lg">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 text-xs tracking-[0.3em] text-blue-200/80 mb-2 font-mono">
              <span className="inline-block w-6 h-px bg-blue-300/60" />
              SCHOOL-BASED&nbsp;RESEARCH
            </div>
            <h1 className="text-2xl font-bold tracking-wide">教研管理</h1>
            <p className="text-blue-100/80 text-sm mt-1.5 leading-relaxed max-w-2xl">
              以课题为锚 · 以数据为镜 · 以释义为桥 —
              让每一次教研讨论都沉淀为可传承的校本资产，新教师入校即可调阅历史经验。
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full border border-white/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="text-xs tracking-wider text-emerald-200 font-mono">{topics.length} 个课题在册</span>
            </div>
            <div className="text-xs text-blue-200/60 font-mono tracking-wider">
              完成率 {completionRate}% · 闭环 {completedCount}/{topics.length}
            </div>
          </div>
        </div>

        {/* 教研四步工作流 */}
        <div className="relative grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          {WORKFLOW.map((step, i) => (
            <div key={step.key} className="relative">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3.5 hover:bg-white/10 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xl">{step.icon}</span>
                  <span className="text-[10px] tracking-[0.2em] text-blue-200/60 font-mono">{step.num}</span>
                </div>
                <div className="font-semibold text-sm tracking-wide">{step.title}</div>
                <div className="text-xs text-blue-100/70 mt-0.5">{step.sub}</div>
                <div className="text-[11px] text-blue-200/50 mt-2 pt-2 border-t border-white/10">{step.desc}</div>
              </div>
              {i < WORKFLOW.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 -translate-y-1/2 z-10 text-blue-300/40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setTab('topics')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === 'topics'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">📋</span>教研议题
          </button>
          <button
            onClick={() => setTab('library')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === 'library'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5">📚</span>校本资源库
          </button>
        </div>
        {tab === 'topics' && topics.length > 0 && (
          <div className="text-xs text-gray-400 font-mono tracking-wider">
            {inProgressCount > 0 ? `${inProgressCount} 个议题待跟进` : '全部议题已闭环'}
          </div>
        )}
      </div>

      {tab === 'library' ? (
        <LibraryView
          groups={libraryByTheme}
          expanded={libraryExpanded}
          toggle={toggleLibrary}
          formatDate={formatDate}
        />
      ) : (
      <>
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard
          label="教研课题"
          value={topics.length}
          accent="blue"
          icon="🎯"
          desc="在册课题数"
        />
        <StatCard
          label="待释义"
          value={Math.max(0, totalAnomaly - totalReviewed)}
          accent="rose"
          icon="⏳"
          desc="等待教师专业判断"
        />
        <StatCard
          label="已释义"
          value={totalReviewed}
          accent="violet"
          icon="💬"
          desc="教师释义已留存"
        />
        <StatCard
          label="完成闭环"
          value={completedCount}
          accent="emerald"
          icon="✓"
          desc={`完成率 ${completionRate}%`}
        />
      </div>

      {/* 课题列表 */}
      <div className="space-y-3">
        {topics.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
            <div className="text-4xl mb-3 opacity-60">📋</div>
            <p className="font-medium text-gray-700">暂无教研议题</p>
            <p className="text-sm mt-2 text-gray-400">完成批量作业分析任务后，系统会自动将值得讨论的课题汇集到此处</p>
          </div>
        ) : (
          topics.map(topic => {
            const status = topic.closure_status || getClosureStatus(topic.anomaly_count || 0, topic.reviewed_count || 0)
            const isOpen = expandedTheme === topic.theme
            const reviewProgress = (topic.anomaly_count || 0) > 0
              ? Math.round(((topic.reviewed_count || 0) / topic.anomaly_count) * 100)
              : 100
            const topicReviews = reviews.filter(r => (r.task_theme || r.theme) === topic.theme)
            return (
              <div key={topic.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${
                isOpen ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}>
                {/* 课题头 */}
                <div
                  onClick={() => toggleExpand(topic.theme)}
                  className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                        <h3 className="font-semibold text-gray-900 truncate">{topic.theme}</h3>
                        <StatusPill status={status} />
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          覆盖 {topic.task_count || 0} 个班级
                        </span>
                      </div>
                      <div className="ml-5 flex items-center gap-5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-400">关注</span>
                          <span className="font-semibold text-gray-800">{topic.anomaly_count || 0}</span>
                          <span className="text-gray-400 text-xs">幅</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-400">已释义</span>
                          <span className="font-semibold text-emerald-600">{topic.reviewed_count || 0}</span>
                          <span className="text-gray-400 text-xs">幅</span>
                        </div>
                        <div className="flex-1 max-w-[180px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  reviewProgress === 100 ? 'bg-emerald-500' :
                                  reviewProgress > 0 ? 'bg-amber-500' : 'bg-gray-300'
                                }`}
                                style={{ width: `${reviewProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 font-mono w-9 text-right">{reviewProgress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 展开内容 */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gradient-to-b from-slate-50/40 via-white to-white">
                    {/* 1. 课题概况 */}
                    <div className="px-5 pt-5 pb-4">
                      <SectionHeader icon="📊" title="课题概况" subtitle="跨班级数据透视" />
                      <div className="grid grid-cols-5 gap-2.5 mt-3">
                        <MiniStat label="覆盖班级" value={topic.task_count || 0} unit="个" />
                        <MiniStat label="参与学生" value={topic.student_count || 0} unit="人" />
                        <MiniStat label="作品总数" value={topic.artwork_count || 0} unit="幅" />
                        <MiniStat label="关注作品" value={topic.anomaly_count || 0} unit="幅" accent="rose" />
                        <MiniStat label="已释义" value={topic.reviewed_count || 0} unit="幅" accent="emerald" />
                      </div>
                      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                        <span className="text-gray-400">闭环进度</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              reviewProgress === 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                              reviewProgress > 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gray-300'
                            }`}
                            style={{ width: `${reviewProgress}%` }}
                          />
                        </div>
                        <span className="font-mono text-gray-600 w-12 text-right">{reviewProgress}%</span>
                        <span className="text-gray-400">{status.desc}</span>
                      </div>
                    </div>

                    {/* 2. 典型作品 · 教师释义 */}
                    {topicReviews.length > 0 && (
                      <div className="px-5 py-4 border-t border-dashed border-gray-200">
                        <SectionHeader
                          icon="💬"
                          title="典型作品 · 教师释义"
                          subtitle="教研讨论中沉淀下来的解读笔记"
                          badge={`${topicReviews.length} 条`}
                          badgeColor="violet"
                        />
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {topicReviews.slice(0, 4).map(r => (
                            <ReviewCard key={r.id} review={r} />
                          ))}
                        </div>
                        {topicReviews.length > 4 && (
                          <button
                            onClick={() => setTab('library')}
                            className="mt-3 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                          >查看全部 {topicReviews.length} 条释义 →</button>
                        )}
                      </div>
                    )}

                    {/* 3. AI 教学参考 */}
                    {topic.teaching_reference?.content && (
                      <div className="px-5 py-4 border-t border-dashed border-gray-200">
                        <SectionHeader
                          icon="✨"
                          title="AI 教学参考"
                          subtitle="基于全主题数据生成的教学建议"
                          badge="KIMI GENERATED"
                          badgeColor="emerald"
                        />
                        <div className="mt-3 relative bg-gradient-to-br from-emerald-50 via-teal-50/60 to-cyan-50/40 border border-emerald-100/80 rounded-xl p-4 overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                          <p
                            className="relative text-sm text-gray-800 leading-relaxed whitespace-pre-line max-h-32 overflow-hidden"
                            style={{
                              WebkitMaskImage: 'linear-gradient(to bottom, #000 60%, transparent 100%)',
                              maskImage: 'linear-gradient(to bottom, #000 60%, transparent 100%)',
                            }}
                          >
                            {topic.teaching_reference.content}
                          </p>
                          <button
                            onClick={() => setTeachingRef(topic.teaching_reference)}
                            className="relative mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            展开查看完整教学参考
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. 教研结论 */}
                    <div className="px-5 py-4 border-t border-dashed border-gray-200">
                      <SectionHeader
                        icon="📝"
                        title="教研结论"
                        subtitle="本次教研讨论形成的共识与教学改进方向"
                      />
                      <textarea
                        value={conclusions[topic.theme] || ''}
                        onChange={e => setConclusions(prev => ({ ...prev, [topic.theme]: e.target.value }))}
                        placeholder="例如：本课题中颜色饱和度普遍偏高，建议下周引导冷色系观察练习..."
                        className="mt-3 w-full border border-gray-200 rounded-lg p-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white leading-relaxed"
                      />
                      <div className="flex justify-between items-center mt-3">
                        <button
                          onClick={() => { setTeachingRef(null); generateTeachingRef(topic.theme) }}
                          disabled={generatingRef === topic.theme}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
                        >
                          {generatingRef === topic.theme ? (
                            <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>生成中...</>
                          ) : (
                            <><span>✨</span>{topic.teaching_reference?.content ? '重新生成教学参考' : 'AI 生成教学参考'}</>
                          )}
                        </button>
                        <div className="flex items-center gap-3">
                          {topic.updated_at && (
                            <span className="text-xs text-gray-400 font-mono">
                              最近更新 · {formatDate(topic.updated_at)}
                            </span>
                          )}
                          <button
                            onClick={() => saveConclusion(topic.theme)}
                            disabled={saving}
                            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all"
                          >
                            {saving ? '保存中...' : '保存结论'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      </>
      )}

      {/* 教学参考弹窗 */}
      {teachingRef && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">✨</span>
                  <h3 className="font-semibold text-gray-800">AI 教学参考</h3>
                  <span className="text-[10px] tracking-[0.2em] text-emerald-600 font-mono px-2 py-0.5 bg-emerald-100 rounded">KIMI&nbsp;GENERATED</span>
                </div>
                <p className="text-xs text-gray-500 ml-7">{expandedTheme}</p>
              </div>
              <button onClick={() => setTeachingRef(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">{teachingRef.content || '暂无内容'}</p>
              </div>
              <div className="mt-3 text-[11px] text-gray-400 text-center">
                ★ 一切只是建议，落不落地，由老师决定
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, icon, desc }) {
  const palette = {
    blue:    { from: 'from-blue-50',    to: 'to-blue-100/40',    text: 'text-blue-700',    ring: 'ring-blue-200/50' },
    rose:    { from: 'from-rose-50',    to: 'to-red-100/40',     text: 'text-rose-700',    ring: 'ring-rose-200/50' },
    violet:  { from: 'from-violet-50',  to: 'to-purple-100/40',  text: 'text-violet-700',  ring: 'ring-violet-200/50' },
    emerald: { from: 'from-emerald-50', to: 'to-green-100/40',   text: 'text-emerald-700', ring: 'ring-emerald-200/50' },
  }[accent] || { from: 'from-gray-50', to: 'to-gray-100/40', text: 'text-gray-700', ring: 'ring-gray-200/50' }

  return (
    <div className={`relative bg-gradient-to-br ${palette.from} ${palette.to} border border-white rounded-xl p-4 ring-1 ${palette.ring} overflow-hidden`}>
      <div className="absolute top-2 right-2 text-2xl opacity-30">{icon}</div>
      <div className="text-xs text-gray-500 tracking-wider">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${palette.text}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-1">{desc}</div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle, badge, badgeColor = 'gray' }) {
  const badgeCls = {
    gray:    'bg-gray-100 text-gray-600 border-gray-200',
    violet:  'bg-violet-50 text-violet-700 border-violet-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
  }[badgeColor]
  return (
    <div className="flex items-center gap-3">
      <span className="text-base">{icon}</span>
      <div className="flex items-baseline gap-2">
        <h4 className="text-sm font-semibold text-gray-800 tracking-wide">{title}</h4>
        {subtitle && <span className="text-xs text-gray-400">— {subtitle}</span>}
      </div>
      {badge && (
        <span className={`ml-auto inline-flex items-center px-2 py-0.5 text-[10px] tracking-[0.15em] font-mono rounded border ${badgeCls}`}>
          {badge}
        </span>
      )}
    </div>
  )
}

function MiniStat({ label, value, unit, accent = 'slate' }) {
  const palette = {
    slate:   'text-gray-800',
    rose:    'text-rose-600',
    emerald: 'text-emerald-600',
  }[accent]
  return (
    <div className="bg-white border border-gray-200/80 rounded-lg px-3 py-2.5">
      <div className="text-[11px] text-gray-400 tracking-wider">{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`text-xl font-bold tabular-nums ${palette}`}>{value}</span>
        {unit && <span className="text-[10px] text-gray-400">{unit}</span>}
      </div>
    </div>
  )
}

function ReviewCard({ review }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-violet-200 transition-all flex">
      <div className="w-24 h-24 bg-gray-50 flex-shrink-0 overflow-hidden">
        {review.image_url ? (
          <img src={review.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
        )}
      </div>
      <div className="flex-1 min-w-0 p-2.5 flex flex-col">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-mono text-gray-400 tracking-wider">{review.class_name}</span>
          {review.artwork_grade && (
            <span className="px-1.5 py-px text-[10px] rounded bg-blue-50 text-blue-600 font-medium">{review.artwork_grade}</span>
          )}
        </div>
        <p className="text-xs text-gray-700 leading-snug line-clamp-3 flex-1">{review.comment}</p>
        <div className="text-[10px] text-gray-400 mt-1 font-mono">
          {review.teacher_name} · {review.created_at ? new Date(review.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const cls = status.color === 'green'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status.color === 'amber'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'
  const dot = status.color === 'green' ? 'bg-emerald-500' : status.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status.label}
    </span>
  )
}

function LibraryView({ groups, expanded, toggle, formatDate }) {
  if (!groups.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
        <div className="text-4xl mb-3 opacity-60">📚</div>
        <p className="font-medium text-gray-700">校本资源库为空</p>
        <p className="text-sm mt-2 text-gray-400">完成教研议题后，典型作品、教师释义与教研结论将按课题汇集到这里</p>
      </div>
    )
  }

  const totals = groups.reduce((acc, g) => ({
    themes: acc.themes + 1,
    reviews: acc.reviews + (g.reviews?.length || 0),
    conclusions: acc.conclusions + g.conclusions.length
  }), { themes: 0, reviews: 0, conclusions: 0 })

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="沉淀课题" value={totals.themes} accent="blue" icon="📂" desc="跨学期累积" />
        <StatCard label="教师释义集" value={totals.reviews} accent="violet" icon="💭" desc="典型作品解读" />
        <StatCard label="教研结论" value={totals.conclusions} accent="emerald" icon="📝" desc="可复用教学共识" />
      </div>

      <div className="space-y-3">
        {groups.map(g => {
          const isOpen = !!expanded[g.theme]
          return (
            <div key={g.theme} className={`bg-white border rounded-xl overflow-hidden transition-all ${
              isOpen ? 'border-amber-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}>
              <div onClick={() => toggle(g.theme)} className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-gray-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                    <h3 className="font-semibold text-gray-900">{g.theme}</h3>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {g.reviews.length + g.conclusions.length} 条沉淀
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 ml-5">
                    <span className="flex items-center gap-1">
                      <span className="text-violet-500">💬</span>{g.reviews.length} 条释义
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="flex items-center gap-1">
                      <span className="text-emerald-500">📝</span>{g.conclusions.length} 条结论
                    </span>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-100 bg-gradient-to-b from-amber-50/30 to-white">
                  {g.reviews.length > 0 && (
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1 h-3 bg-violet-500 rounded-full" />
                        典型作品（教师已释义）
                      </h4>
                      <div className="grid grid-cols-4 gap-3">
                        {g.reviews.slice(0, 8).map(r => (
                          <div key={r.id} className="border border-gray-200 rounded-lg p-2 bg-white hover:shadow-sm transition-shadow">
                            <div className="h-24 bg-gray-100 rounded mb-2 overflow-hidden">
                              {r.image_url ? (
                                <img src={r.image_url} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                              )}
                            </div>
                            <div className="text-xs">
                              <div className="text-gray-500 truncate">{r.class_name}</div>
                              <div className="text-gray-700 mt-1 line-clamp-2">{r.comment}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {g.conclusions.length > 0 && (
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                        历次教研结论
                      </h4>
                      <div className="space-y-2">
                        {g.conclusions.map((c, i) => (
                          <div key={i} className="border-l-4 border-emerald-400 bg-emerald-50/60 px-3 py-2.5 rounded-r-lg">
                            <div className="text-xs text-gray-500 mb-1 font-mono">{formatDate(c.date)}</div>
                            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {g.reviews.length === 0 && g.conclusions.length === 0 && (
                    <div className="p-4 text-sm text-gray-400 text-center">暂无沉淀内容</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { Router } from 'express'
import { z } from 'zod'
import { dbGet, dbAll, dbRun, dbExec } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { requireOwnership } from '../middleware/requireOwnership.js'

const createTaskSchema = z.object({
  classId: z.number().int().positive(),
  theme: z.string().min(1).max(200),
  themeTemplateId: z.number().int().positive().optional()
})

const updateTaskSchema = z.object({
  research_conclusion: z.string().max(10000).optional()
})

const router = Router()

// 获取任务列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tasks = await dbAll(`
      SELECT t.*, c.name as class_name, u.name as teacher_name,
        (SELECT COUNT(*) FROM artworks a WHERE a.task_id = t.id) as totalArtworks,
        (SELECT COUNT(*) FROM artworks a WHERE a.task_id = t.id AND a.is_anomaly = 1) as anomalyCount,
        (SELECT COUNT(*) FROM teacher_reviews tr
         JOIN artworks a ON tr.artwork_id = a.id
         WHERE a.task_id = t.id AND a.is_anomaly = 1) as reviewedCount
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      JOIN users u ON t.teacher_id = u.id
      WHERE t.teacher_id = ? OR ? = 'admin'
      ORDER BY t.created_at DESC
    `, [req.user.id, req.user.role])
    res.json(tasks.map(t => ({
      ...t,
      result_summary: t.result_summary ? JSON.parse(t.result_summary) : null
    })))
  } catch (err) {
    console.error('Error fetching tasks:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取任务详情
router.get('/:id', authMiddleware, requireOwnership('analysis_tasks'), async (req, res) => {
  try {
    const task = await dbGet(`
      SELECT t.*, c.name as class_name, c.grade_id, g.school_id, u.name as teacher_name
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      JOIN grades g ON c.grade_id = g.id
      JOIN users u ON t.teacher_id = u.id
      WHERE t.id = ?
    `, [req.params.id])

    if (!task) return res.status(404).json({ error: 'Task not found' })

    const stats = await dbGet(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN a.grade = 'A' THEN 1 ELSE 0 END) as gradeA,
        SUM(CASE WHEN a.grade = 'B' THEN 1 ELSE 0 END) as gradeB,
        SUM(CASE WHEN a.grade = 'C' THEN 1 ELSE 0 END) as gradeC,
        SUM(CASE WHEN a.grade = 'D' THEN 1 ELSE 0 END) as gradeD,
        SUM(CASE WHEN a.is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount,
        AVG(a.total_score) as avgScore
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE a.task_id = ?
    `, [req.params.id])

    // Calculate analysis duration
    let analysisDuration = null
    if (task.analysis_started_at && task.analysis_completed_at) {
      const start = new Date(task.analysis_started_at)
      const end = new Date(task.analysis_completed_at)
      analysisDuration = Math.round((end - start) / 1000) // seconds
    }

    res.json({
      ...task,
      grade_id: task.grade_id,
      school_id: task.school_id,
      result_summary: task.result_summary ? JSON.parse(task.result_summary) : null,
      stats,
      analysisDuration
    })
  } catch (err) {
    console.error('Error fetching task detail:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 创建任务（仅教师/管理员）
router.post('/', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const parsed = createTaskSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

    const { classId, theme, themeTemplateId } = parsed.data
    const result = await dbRun(
      `INSERT INTO analysis_tasks (class_id, teacher_id, theme, theme_template_id, status) VALUES (?, ?, ?, ?, 'pending')`,
      [classId, req.user.id, theme, themeTemplateId || null]
    )
    res.json({ id: result.lastID, status: 'pending' })
  } catch (err) {
    console.error('Error creating task:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 生成教学参考（基于分析数据生成下轮主题设计建议）
router.post('/:id/generate-reference', authMiddleware, requireRole('teacher'), requireOwnership('analysis_tasks'), async (req, res) => {
  try {
    const taskId = req.params.id

    // 获取任务详情
    const task = await dbGet(`
      SELECT t.*, c.name as class_name, th.name as theme_template_name, th.type as theme_type
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      LEFT JOIN themes th ON t.theme_template_id = th.id
      WHERE t.id = ?
    `, [taskId])

    if (!task) return res.status(404).json({ error: '任务不存在' })

    // 获取作品统计数据
    const stats = await dbGet(`
      SELECT
        COUNT(*) as total,
        AVG(a.total_score) as avgScore,
        AVG(a.scores->>'$.color') as avgColor,
        AVG(a.scores->>'$.composition') as avgComposition,
        AVG(a.scores->>'$.theme') as avgTheme,
        AVG(a.scores->>'$.expression') as avgExpression,
        SUM(CASE WHEN a.is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE a.task_id = ?
    `, [taskId])

    // 获取关注作品的教师释义
    const reviews = await dbAll(`
      SELECT tr.comment, a.anomaly_reason, s.name as student_name
      FROM teacher_reviews tr
      JOIN artworks a ON tr.artwork_id = a.id
      JOIN students s ON a.student_id = s.id
      WHERE a.task_id = ?
      ORDER BY tr.created_at DESC
    `, [taskId])

    // 基于数据生成教学参考
    const reference = generateTeachingReference(task, stats, reviews)
    res.json(reference)
  } catch (err) {
    console.error('Error generating reference:', err)
    res.status(500).json({ error: '生成教学参考失败' })
  }
})

function generateTeachingReference(task, stats, reviews) {
  const suggestions = []
  const { avgScore, avgColor, avgComposition, avgTheme, avgExpression, anomalyCount } = stats || {}

  // 基于薄弱维度给出建议
  const dims = [
    { name: '色彩运用', avg: avgColor, key: 'color' },
    { name: '构图完整度', avg: avgComposition, key: 'composition' },
    { name: '主题契合度', avg: avgTheme, key: 'theme' },
    { name: '造型表现力', avg: avgExpression, key: 'expression' }
  ].filter(d => d.avg > 0).sort((a, b) => a.avg - b.avg)

  if (dims.length > 0) {
    const weakest = dims[0]
    if (weakest.avg < 65) {
      suggestions.push({
        type: '薄弱维度',
        content: `根据本次分析，班级在「${weakest.name}」维度相对薄弱（均分${Math.round(weakest.avg)}分）。建议在下一轮主题设计中增加针对性的${weakest.name}训练活动。`
      })
    }

    const strongest = dims[dims.length - 1]
    if (strongest.avg > 80) {
      suggestions.push({
        type: '优势保持',
        content: `班级在「${strongest.name}」维度表现突出（均分${Math.round(strongest.avg)}分），可作为下一主题的起点，鼓励学生延续这一优势。`
      })
    }
  }

  // 基于关注作品的建议
  if (anomalyCount > 0) {
    suggestions.push({
      type: '个性化关注',
      content: `本次有${anomalyCount}幅作品值得关注。教研时建议重点讨论这些作品的独特表达方式，作为教学资源而非问题案例。`
    })

    if (reviews.length > 0) {
      const uniqueReasons = [...new Set(reviews.map(r => r.anomaly_reason).filter(Boolean))]
      if (uniqueReasons.length > 0) {
        suggestions.push({
          type: '差异化教学',
          content: `关注作品主要集中在：${uniqueReasons.join('、')}。建议在教学中增加多样化的表达引导，避免学生趋同。`
        })
      }
    }
  }

  // 基于课题模板的建议
  if (task.theme_type) {
    suggestions.push({
      type: '课题选择',
      content: `建议下一轮选择与「${task.theme_type}」不同类型的课题，促进学生在多元艺术形式中发展。`
    })
  }

  // 总体建议
  if (avgScore && avgScore > 80) {
    suggestions.push({
      type: '整体评价',
      content: `本轮整体表现良好。建议延续现有教学方法，同时关注学生个体的差异化发展。`
    })
  } else if (avgScore && avgScore < 60) {
    suggestions.push({
      type: '整体评价',
      content: `本轮整体表现有较大提升空间。建议与教研组共同分析原因，制定针对性的教学改进计划。`
    })
  }

  return {
    taskId: task.id,
    theme: task.theme,
    className: task.class_name,
    generatedAt: new Date().toISOString(),
    summary: {
      totalArtworks: stats?.total || 0,
      avgScore: Math.round(avgScore || 0),
      anomalyCount: anomalyCount || 0,
      reviewedCount: reviews.length
    },
    suggestions
  }
}

// 更新任务（教研结论等，仅教师/管理员）
router.patch('/:id', authMiddleware, requireRole('teacher'), requireOwnership('analysis_tasks'), async (req, res) => {
  try {
    const parsed = updateTaskSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

    const { research_conclusion } = parsed.data
    const result = await dbRun(
      'UPDATE analysis_tasks SET research_conclusion = ? WHERE id = ?',
      [research_conclusion, req.params.id]
    )
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' })
    res.json({ ok: true })
  } catch (err) {
    console.error('Error updating task:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// AI 分析任务下所有作品（仅教师/管理员）
router.post('/:id/analyze', authMiddleware, requireRole('teacher'), requireOwnership('analysis_tasks'), async (req, res) => {
  const taskId = req.params.id

  try {
    const task = await dbGet('SELECT * FROM analysis_tasks WHERE id = ?', [taskId])
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.status === 'processing') return res.status(409).json({ error: '分析正在进行中，请勿重复提交' })

    // 清空已有分析数据，重新开始
    await dbRun(
      `UPDATE artworks SET scores = NULL, grade = NULL, total_score = NULL, is_anomaly = 0, anomaly_reason = NULL WHERE task_id = ?`,
      [taskId]
    )
    await dbRun(
      `UPDATE analysis_tasks SET status = 'processing', processed_count = 0, total_count = 0,
       analysis_started_at = CURRENT_TIMESTAMP, analysis_completed_at = NULL,
       teaching_suggestion = NULL WHERE id = ?`,
      [taskId]
    )

    // Send response immediately, process in background
    res.json({ status: 'processing', taskId })

    // Process artworks asynchronously
    processAnalysis(taskId, task.class_id, task.theme).catch(err => {
      console.error('Analysis failed:', err)
      dbRun('UPDATE analysis_tasks SET status = ? WHERE id = ?', ['failed', taskId])
    })
  } catch (err) {
    console.error('Error starting analysis:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 暂停分析
router.post('/:id/pause', authMiddleware, requireRole('teacher'), requireOwnership('analysis_tasks'), async (req, res) => {
  const taskId = req.params.id
  const state = analysisState.get(taskId)
  if (!state) {
    // in-memory 状态丢失（如服务重启留下的幽灵任务）：直接置为 stopped 让前端能脱困
    const task = await dbGet('SELECT status FROM analysis_tasks WHERE id = ?', [taskId])
    if (task && (task.status === 'processing' || task.status === 'paused')) {
      await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', ['stopped', taskId])
      return res.json({ ok: true, status: 'stopped', note: '运行状态已丢失，任务已停止' })
    }
    return res.status(400).json({ error: '无正在进行的分析任务' })
  }
  state.paused = true
  await dbRun('UPDATE analysis_tasks SET status = ? WHERE id = ?', ['paused', taskId])
  res.json({ ok: true, status: 'paused' })
})

// 继续分析
router.post('/:id/resume', authMiddleware, requireRole('teacher'), requireOwnership('analysis_tasks'), async (req, res) => {
  const taskId = req.params.id
  const state = analysisState.get(taskId)
  if (!state) return res.status(400).json({ error: '无正在暂停的分析任务，请重新发起分析' })
  state.paused = false
  await dbRun('UPDATE analysis_tasks SET status = ? WHERE id = ?', ['processing', taskId])
  res.json({ ok: true, status: 'processing' })
})

// 停止分析
router.post('/:id/stop', authMiddleware, requireRole('teacher'), requireOwnership('analysis_tasks'), async (req, res) => {
  const taskId = req.params.id
  const state = analysisState.get(taskId)
  if (state) {
    state.stopped = true
    state.abortController?.abort()
  }
  // 无论是否有 in-memory 状态：只要 DB 标记为运行/暂停中,就允许停止
  const task = await dbGet('SELECT status FROM analysis_tasks WHERE id = ?', [taskId])
  if (!task) return res.status(404).json({ error: 'Task not found' })
  if (task.status !== 'processing' && task.status !== 'paused') {
    return res.status(400).json({ error: `任务当前状态为 ${task.status}，无需停止` })
  }
  await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', ['stopped', taskId])
  res.json({ ok: true, status: 'stopped' })
})

// 启动时回收幽灵任务：服务重启后 in-memory 的 analysisState 已丢失，
// 把 DB 里残留的 processing/paused 任务全部标记为 stopped，避免 UI 卡在"分析中"
export async function recoverOrphanedTasks() {
  try {
    const orphans = await dbAll(`SELECT id, status FROM analysis_tasks WHERE status IN ('processing', 'paused')`)
    if (orphans.length === 0) return
    await dbRun(
      `UPDATE analysis_tasks SET status = 'stopped', analysis_completed_at = CURRENT_TIMESTAMP
       WHERE status IN ('processing', 'paused')`
    )
    console.log(`[Tasks] 启动回收幽灵任务: ${orphans.length} 个 → stopped (ids: ${orphans.map(o => o.id).join(',')})`)
  } catch (err) {
    console.error('[Tasks] 幽灵任务回收失败:', err)
  }
}

const CONCURRENCY = 3

// In-memory analysis control state
const analysisState = new Map() // taskId -> { paused: boolean, stopped: boolean, abortController: AbortController }

async function processAnalysis(taskId, classId, theme) {
  const { analyzeArtwork } = await import('../services/miniMax.js')

  analysisState.set(taskId, { paused: false, stopped: false, abortController: new AbortController() })

  const artworks = await dbAll(
    `SELECT a.* FROM artworks a
     WHERE a.task_id = ?`,
    [taskId]
  )

  await dbRun(
    'UPDATE analysis_tasks SET total_count = ?, processed_count = 0 WHERE id = ?',
    [artworks.length, taskId]
  )

  let failedCount = 0

  for (let i = 0; i < artworks.length; i += CONCURRENCY) {
    // Check stop signal
    const state = analysisState.get(taskId)
    if (state?.stopped) {
      console.log(`[Analysis] Task ${taskId} stopped by user`)
      await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', ['stopped', taskId])
      analysisState.delete(taskId)
      return
    }

    // Wait while paused
    while (analysisState.get(taskId)?.paused && !analysisState.get(taskId)?.stopped) {
      await new Promise(r => setTimeout(r, 500))
    }

    const batch = artworks.slice(i, i + CONCURRENCY)

    // Check stop before launching batch
    if (analysisState.get(taskId)?.stopped) {
      console.log(`[Analysis] Task ${taskId} stopped before batch`)
      await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', ['stopped', taskId])
      analysisState.delete(taskId)
      return
    }

    const results = await Promise.allSettled(
      batch.map(art => analyzeArtwork(art.image_url, theme, analysisState.get(taskId)?.abortController?.signal))
    )

    // Check stop after batch completes, before writing results
    if (analysisState.get(taskId)?.stopped) {
      console.log(`[Analysis] Task ${taskId} stopped after batch`)
      await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', ['stopped', taskId])
      analysisState.delete(taskId)
      return
    }

    for (let j = 0; j < batch.length; j++) {
      const art = batch[j]
      const result = results[j]

      if (result.status === 'fulfilled') {
        // 只写分数和异常标记，不写等级——等级最后统一分配
        await dbRun(
          `UPDATE artworks SET scores = ?, total_score = ?, is_anomaly = ?, anomaly_reason = ?, task_id = ? WHERE id = ?`,
          [JSON.stringify(result.value.scores), result.value.totalScore, result.value.isAnomaly ? 1 : 0, result.value.reason, taskId, art.id]
        )
      } else {
        console.error(`Failed to analyze artwork ${art.id}:`, result.reason)
        failedCount++
      }

      await dbRun(
        'UPDATE analysis_tasks SET processed_count = processed_count + 1 WHERE id = ?',
        [taskId]
      )
    }
  }

  analysisState.delete(taskId)
  const status = failedCount === artworks.length ? 'failed' : 'completed'

  // 分析全部完成后，按比例重新分配等级，再做后续处理
  if (status === 'completed') {
    try {
      await assignGradesByRatio(taskId)
    } catch (err) {
      console.error('[Analysis] 比例等级分配失败:', err)
    }
    try {
      await reEvaluateClassOutliers(taskId)
    } catch (err) {
      console.error('[Analysis] 班级差异度扫描失败:', err)
    }
    try {
      await buildAndPersistResultSummary(taskId)
    } catch (err) {
      console.error('[Analysis] 生成 result_summary 失败:', err)
    }
  }

  await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', [status, taskId])
}

// 按比例分配 ABCD 等级：目标比例 A:B:C:D ≈ 8:5:3:1
// 按 total_score 降序排列后，按比例切割赋等级，保证比例稳定
async function assignGradesByRatio(taskId) {
  const artworks = await dbAll(
    'SELECT id, total_score FROM artworks WHERE task_id = ? AND total_score IS NOT NULL ORDER BY total_score DESC',
    [taskId]
  )
  if (!artworks.length) return

  const total = artworks.length
  // 目标比例 8:5:3:1，总和 17
  const ratioA = 8 / 17
  const ratioB = 5 / 17
  const ratioC = 3 / 17

  const countA = Math.max(1, Math.round(total * ratioA))
  const countB = Math.max(1, Math.round(total * ratioB))
  const countC = Math.max(1, Math.round(total * ratioC))

  console.log(`[Analysis] 比例等级分配: 总${total}幅 → A:${countA} B:${countB} C:${countC} D:${total - countA - countB - countC}`)

  for (let i = 0; i < artworks.length; i++) {
    let grade
    if (i < countA) grade = 'A'
    else if (i < countA + countB) grade = 'B'
    else if (i < countA + countB + countC) grade = 'C'
    else grade = 'D'

    if (artworks[i].grade !== grade) {
      await dbRun('UPDATE artworks SET grade = ? WHERE id = ?', [grade, artworks[i].id])
    }
  }
}

// 班级差异度真算法：基于色彩/构图/主题/造型与班级均值的偏离度，把显著偏离的作品标为
// "值得多看一眼"(notice) 或 "需教师关注"(warn)。不覆盖已经在单幅 AI 阶段标为 warn 的作品。
async function reEvaluateClassOutliers(taskId) {
  const artworks = await dbAll(
    `SELECT id, scores, is_anomaly, anomaly_reason FROM artworks WHERE task_id = ? AND scores IS NOT NULL`,
    [taskId]
  )
  if (artworks.length < 6) return // 样本太少不做差异度判断

  const parsed = artworks.map(a => ({
    id: a.id,
    is_anomaly: a.is_anomaly,
    anomaly_reason: a.anomaly_reason,
    scores: JSON.parse(a.scores)
  }))

  const dims = ['color', 'composition', 'theme', 'expression']
  const stats = {}
  dims.forEach(d => {
    const vals = parsed.map(p => p.scores?.[d]).filter(v => typeof v === 'number')
    if (!vals.length) { stats[d] = { mean: 0, std: 0 }; return }
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length
    stats[d] = { mean, std: Math.sqrt(variance) || 1 }
  })

  // 深色比例的班级均值
  const darkVals = parsed.map(p => {
    const cd = p.scores?.colorDist || {}
    return (cd.black || 0) + (cd.brown || 0) + (cd.gray || 0)
  })
  const darkMean = darkVals.reduce((s, v) => s + v, 0) / darkVals.length
  const darkStd = Math.sqrt(darkVals.reduce((s, v) => s + (v - darkMean) ** 2, 0) / darkVals.length) || 1

  const labels = { color: '色彩', composition: '构图', theme: '主题', expression: '造型' }
  const WARN_RE = /深色|压抑|重点关注|需关注|情绪/

  for (const a of parsed) {
    // 单幅阶段已经被标为 warn 的(reason 含深色等关键词)不再覆盖
    if (a.is_anomaly && WARN_RE.test(a.anomaly_reason || '')) continue

    const reasons = []
    let maxZ = 0
    let warnTriggered = false

    // 维度偏离：低于均值 1.5σ 以上视为"显著偏离"
    dims.forEach(d => {
      const v = a.scores?.[d]
      if (typeof v !== 'number') return
      const { mean, std } = stats[d]
      const z = (mean - v) / std
      if (z >= 1.5) {
        reasons.push(`${labels[d]}维度低于班级均值${z.toFixed(1)}σ(${v} vs 均值${Math.round(mean)})`)
        if (z > maxZ) maxZ = z
      } else if (z <= -1.8) {
        reasons.push(`${labels[d]}维度显著高于班级(+${(-z).toFixed(1)}σ)`)
      }
    })

    // 深色比例偏高：超出班级均值 2σ → warn,1.5σ → notice
    const darkVal = (a.scores?.colorDist?.black || 0) + (a.scores?.colorDist?.brown || 0) + (a.scores?.colorDist?.gray || 0)
    const darkZ = (darkVal - darkMean) / darkStd
    if (darkZ >= 2) {
      reasons.unshift(`深色占比显著高于班级整体(${darkVal}%, 班级均${Math.round(darkMean)}%), 情绪表达需关注`)
      warnTriggered = true
    } else if (darkZ >= 1.5) {
      reasons.push(`深色占比偏高(${darkVal}% vs 班级均${Math.round(darkMean)}%)`)
    }

    if (reasons.length === 0) continue

    const newReason = reasons.join('; ')
    const newAnomaly = (warnTriggered || maxZ >= 1.5) ? 1 : a.is_anomaly
    if (newAnomaly !== a.is_anomaly || newReason !== a.anomaly_reason) {
      await dbRun(
        'UPDATE artworks SET is_anomaly = ?, anomaly_reason = ? WHERE id = ?',
        [newAnomaly, newReason, a.id]
      )
    }
  }
}

// 基于已分析作品聚合本次的 trend 点 + wordcloud,并合并入 task.result_summary
async function buildAndPersistResultSummary(taskId) {
  const task = await dbGet('SELECT theme, result_summary FROM analysis_tasks WHERE id = ?', [taskId])
  if (!task) return

  const artworks = await dbAll(
    `SELECT scores, grade, is_anomaly FROM artworks WHERE task_id = ? AND scores IS NOT NULL`,
    [taskId]
  )
  if (!artworks.length) return

  const parsed = artworks.map(a => ({
    scores: JSON.parse(a.scores),
    grade: a.grade,
    is_anomaly: a.is_anomaly,
  }))

  const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0
  const dims = { color: [], composition: [], theme: [], expression: [] }
  const colorAccum = {}
  const compCount = { '居中式': 0, '满幅式': 0, '分割式': 0, '留白式': 0 }
  let anomalyCount = 0

  parsed.forEach(a => {
    if (a.is_anomaly) anomalyCount++
    const s = a.scores || {}
    if (typeof s.color === 'number') dims.color.push(s.color)
    if (typeof s.composition === 'number') dims.composition.push(s.composition)
    if (typeof s.theme === 'number') dims.theme.push(s.theme)
    if (typeof s.expression === 'number') dims.expression.push(s.expression)
    if (s.colorDist) {
      Object.entries(s.colorDist).forEach(([k, v]) => {
        colorAccum[k] = (colorAccum[k] || 0) + (Number(v) || 0)
      })
    }
    if (s.compositionType && compCount[s.compositionType] !== undefined) {
      compCount[s.compositionType]++
    }
  })

  const today = new Date().toISOString().slice(0, 10)
  const newTrendPoint = {
    label: task.theme,
    date: today,
    color: avg(dims.color),
    composition: avg(dims.composition),
    theme: avg(dims.theme),
    expression: avg(dims.expression),
  }

  const existing = task.result_summary ? safeParseJSON(task.result_summary) : {}
  const prevTrend = Array.isArray(existing?.trend) ? existing.trend : []
  // 删除任何 label 与本次主题相同的旧条目,再追加本次真实结果
  const trend = prevTrend.filter(t => t.label !== task.theme).concat([newTrendPoint])

  // 基于真实统计生成 wordcloud(16 词上限)
  const wordcloud = buildWordCloudFromStats(parsed.length, dims, colorAccum, compCount, anomalyCount)

  const newSummary = { ...existing, trend, wordcloud }
  await dbRun('UPDATE analysis_tasks SET result_summary = ? WHERE id = ?', [JSON.stringify(newSummary), taskId])
}

function safeParseJSON(str) {
  try { return JSON.parse(str) } catch { return {} }
}

function buildWordCloudFromStats(total, dims, colorAccum, compCount, anomalyCount) {
  if (!total) return []
  const words = []
  const colorNames = { red:'红色', orange:'橙色', yellow:'黄色', green:'绿色', cyan:'青色', blue:'蓝色', purple:'紫色', pink:'粉色', brown:'棕色', gray:'灰色', black:'黑色' }

  // 颜色 top3
  const topColors = Object.entries(colorAccum)
    .map(([k, v]) => ({ k, pct: Math.round(v / total) }))
    .filter(c => c.pct > 0 && colorNames[c.k])
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3)
  topColors.forEach((c, i) => {
    words.push({ word: colorNames[c.k], weight: c.pct })
    if (i === 0 && c.pct >= 25) words.push({ word: `${colorNames[c.k]}满目`, weight: Math.max(8, c.pct - 5) })
  })

  // 构图 top
  const topComp = Object.entries(compCount).sort((a, b) => b[1] - a[1])[0]
  if (topComp && topComp[1] > 0) words.push({ word: topComp[0], weight: Math.round((topComp[1] / total) * 100) })

  // 各维度均分衍生的特征词
  const avgColor = dims.color.length ? Math.round(dims.color.reduce((s, v) => s + v, 0) / dims.color.length) : 0
  const avgComp = dims.composition.length ? Math.round(dims.composition.reduce((s, v) => s + v, 0) / dims.composition.length) : 0
  const avgTheme = dims.theme.length ? Math.round(dims.theme.reduce((s, v) => s + v, 0) / dims.theme.length) : 0
  const avgExpr = dims.expression.length ? Math.round(dims.expression.reduce((s, v) => s + v, 0) / dims.expression.length) : 0

  if (avgColor >= 80) words.push({ word: '色彩鲜艳', weight: avgColor - 60 })
  else if (avgColor < 65) words.push({ word: '色彩单一', weight: 70 - avgColor })

  if (avgComp >= 80) words.push({ word: '构图饱满', weight: avgComp - 60 })
  else if (avgComp < 65) words.push({ word: '构图松散', weight: 70 - avgComp })

  if (avgTheme >= 85) words.push({ word: '主题鲜明', weight: avgTheme - 65 })
  else if (avgTheme < 60) words.push({ word: '主题待加强', weight: 70 - avgTheme })

  if (avgExpr >= 80) words.push({ word: '造型生动', weight: avgExpr - 60 })

  // 整体氛围词(基于色彩冷暖比例)
  const warmPct = ['red', 'orange', 'yellow'].reduce((s, k) => s + Math.round((colorAccum[k] || 0) / total), 0)
  const coldPct = ['blue', 'cyan', 'purple'].reduce((s, k) => s + Math.round((colorAccum[k] || 0) / total), 0)
  if (warmPct > 30) words.push({ word: '温暖明亮', weight: warmPct })
  if (coldPct > 25) words.push({ word: '冷色清新', weight: coldPct })

  // 异常作品提示词
  if (anomalyCount > 0) {
    words.push({ word: '视角独特', weight: Math.min(20, anomalyCount * 6) })
    if (anomalyCount / total >= 0.1) words.push({ word: '风格分化', weight: Math.round((anomalyCount / total) * 60) })
  }

  // 去重 + 排序 + 截断
  const seen = new Set()
  return words
    .filter(w => { if (seen.has(w.word)) return false; seen.add(w.word); return true })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 16)
}

// AI 教学建议生成（缓存机制，refresh=true 时强制重新生成）
router.post('/:id/teaching-suggestions', authMiddleware, requireOwnership('analysis_tasks'), async (req, res) => {
  try {
    const taskId = req.params.id
    const refresh = req.query.refresh === 'true'

    const task = await dbGet(`
      SELECT t.*, c.name as class_name
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      WHERE t.id = ?
    `, [taskId])

    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.status !== 'completed') return res.status(400).json({ error: 'Analysis not completed yet' })

    // 有缓存且不强制刷新，直接返回
    if (!refresh && task.teaching_suggestion) {
      return res.json({ suggestion: task.teaching_suggestion, source: 'cached' })
    }

    const artworks = await dbAll(`
      SELECT a.* FROM artworks a
      WHERE a.task_id = ?
    `, [taskId])

    const parsed = artworks.map(a => ({
      ...a,
      scores: a.scores ? JSON.parse(a.scores) : null
    }))

    const grades = { A: 0, B: 0, C: 0, D: 0 }
    const dims = { color: [], composition: [], theme: [], expression: [] }
    const colorDistMap = {}
    const compDistMap = { '居中式': 0, '满幅式': 0, '分割式': 0, '留白式': 0 }

    parsed.forEach(a => {
      if (a.grade) grades[a.grade] = (grades[a.grade] || 0) + 1
      if (a.scores) {
        dims.color.push(a.scores.color)
        dims.composition.push(a.scores.composition)
        dims.theme.push(a.scores.theme)
        dims.expression.push(a.scores.expression)
        if (a.scores.colorDist) {
          Object.entries(a.scores.colorDist).forEach(([k, v]) => {
            colorDistMap[k] = (colorDistMap[k] || 0) + v
          })
        }
        if (a.scores.compositionType) {
          compDistMap[a.scores.compositionType] = (compDistMap[a.scores.compositionType] || 0) + 1
        }
      }
    })

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
    const dimStats = [
      { label: '色彩运用', avg: avg(dims.color), min: dims.color.length ? Math.min(...dims.color) : 0, max: dims.color.length ? Math.max(...dims.color) : 0 },
      { label: '构图完整度', avg: avg(dims.composition), min: dims.composition.length ? Math.min(...dims.composition) : 0, max: dims.composition.length ? Math.max(...dims.composition) : 0 },
      { label: '主题契合度', avg: avg(dims.theme), min: dims.theme.length ? Math.min(...dims.theme) : 0, max: dims.theme.length ? Math.max(...dims.theme) : 0 },
      { label: '造型表现力', avg: avg(dims.expression), min: dims.expression.length ? Math.min(...dims.expression) : 0, max: dims.expression.length ? Math.max(...dims.expression) : 0 },
    ]

    const colorKeys = ['red','orange','yellow','green','cyan','blue','purple','pink','brown','gray','black']
    const colorNames = { red:'红', orange:'橙', yellow:'黄', green:'绿', cyan:'青', blue:'蓝', purple:'紫', pink:'粉', brown:'棕', gray:'灰', black:'黑' }
    const count = parsed.length || 1
    const colorDist = colorKeys.map(k => ({ color: colorNames[k], pct: Math.round((colorDistMap[k] || 0) / count) })).filter(c => c.pct > 0)
    const compDist = Object.entries(compDistMap).map(([type, cnt]) => ({ type, count: cnt, pct: Math.round((cnt / count) * 100) })).filter(c => c.count > 0)

    const { generateTeachingSuggestions } = await import('../services/miniMax.js')
    const suggestion = await generateTeachingSuggestions(
      task.theme, task.class_name, dimStats, colorDist, compDist, grades, parsed.length, parsed.filter(a => a.is_anomaly).length
    )

    // 保存到数据库
    await dbRun('UPDATE analysis_tasks SET teaching_suggestion = ? WHERE id = ?', [suggestion || '', taskId])

    res.json({ suggestion: suggestion || task.teaching_suggestion || '', source: suggestion ? 'ai' : 'local' })
  } catch (err) {
    console.error('Error generating teaching suggestions:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 班级观察笔记生成（缓存机制，refresh=true 时强制重新生成）
router.post('/:id/class-observation', authMiddleware, requireOwnership('analysis_tasks'), async (req, res) => {
  try {
    const taskId = req.params.id
    const refresh = req.query.refresh === 'true'

    const task = await dbGet(`
      SELECT t.*, c.name as class_name
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      WHERE t.id = ?
    `, [taskId])

    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.status !== 'completed') return res.status(400).json({ error: 'Analysis not completed yet' })

    const existingSummary = task.result_summary ? safeParseJSON(task.result_summary) : {}

    // 缓存命中
    if (!refresh && existingSummary.observation) {
      return res.json({ observation: existingSummary.observation, source: 'cached' })
    }

    const artworks = await dbAll('SELECT * FROM artworks WHERE task_id = ?', [taskId])
    const parsed = artworks.map(a => ({ ...a, scores: a.scores ? JSON.parse(a.scores) : null }))

    const grades = { A: 0, B: 0, C: 0, D: 0 }
    const dims = { color: [], composition: [], theme: [], expression: [] }
    const colorDistMap = {}
    const compDistMap = { '居中式': 0, '满幅式': 0, '分割式': 0, '留白式': 0 }

    parsed.forEach(a => {
      if (a.grade) grades[a.grade] = (grades[a.grade] || 0) + 1
      if (a.scores) {
        dims.color.push(a.scores.color)
        dims.composition.push(a.scores.composition)
        dims.theme.push(a.scores.theme)
        dims.expression.push(a.scores.expression)
        if (a.scores.colorDist) Object.entries(a.scores.colorDist).forEach(([k, v]) => { colorDistMap[k] = (colorDistMap[k] || 0) + v })
        if (a.scores.compositionType) compDistMap[a.scores.compositionType] = (compDistMap[a.scores.compositionType] || 0) + 1
      }
    })

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
    const dimStats = [
      { label: '色彩运用', avg: avg(dims.color), min: dims.color.length ? Math.min(...dims.color) : 0, max: dims.color.length ? Math.max(...dims.color) : 0 },
      { label: '构图完整度', avg: avg(dims.composition), min: dims.composition.length ? Math.min(...dims.composition) : 0, max: dims.composition.length ? Math.max(...dims.composition) : 0 },
      { label: '主题契合度', avg: avg(dims.theme), min: dims.theme.length ? Math.min(...dims.theme) : 0, max: dims.theme.length ? Math.max(...dims.theme) : 0 },
      { label: '造型表现力', avg: avg(dims.expression), min: dims.expression.length ? Math.min(...dims.expression) : 0, max: dims.expression.length ? Math.max(...dims.expression) : 0 },
    ]

    const colorNames = { red:'红', orange:'橙', yellow:'黄', green:'绿', cyan:'青', blue:'蓝', purple:'紫', pink:'粉', brown:'棕', gray:'灰', black:'黑' }
    const colorKeys = ['red','orange','yellow','green','cyan','blue','purple','pink','brown','gray','black']
    const count = parsed.length || 1
    const colorDist = colorKeys.map(k => ({ color: colorNames[k], pct: Math.round((colorDistMap[k] || 0) / count) })).filter(c => c.pct > 0)
    const compDist = Object.entries(compDistMap).map(([type, cnt]) => ({ type, count: cnt, pct: Math.round((cnt / count) * 100) })).filter(c => c.count > 0)

    const { generateClassObservation } = await import('../services/miniMax.js')
    const observation = await generateClassObservation(
      task.theme, task.class_name, dimStats, colorDist, compDist, grades, parsed.length, parsed.filter(a => a.is_anomaly).length
    )

    if (observation) {
      const newSummary = { ...existingSummary, observation }
      await dbRun('UPDATE analysis_tasks SET result_summary = ? WHERE id = ?', [JSON.stringify(newSummary), taskId])
    }

    res.json({ observation: observation || '', source: observation ? 'ai' : 'local' })
  } catch (err) {
    console.error('Error generating class observation:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 导出任务完整报告
router.get('/:id/export', authMiddleware, requireOwnership('analysis_tasks'), async (req, res) => {
  try {
    const taskId = req.params.id

    const task = await dbGet(`
      SELECT t.*, c.name as class_name, g.name as grade_name, s.name as school_name
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      JOIN grades g ON c.grade_id = g.id
      JOIN schools s ON g.school_id = s.id
      WHERE t.id = ?
    `, [taskId])

    if (!task) return res.status(404).json({ error: 'Task not found' })

    const artworks = await dbAll(`
      SELECT a.*, s.name as student_name, s.student_no
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE a.task_id = ?
      ORDER BY a.total_score DESC
    `, [taskId])

    const parsed = artworks.map(a => ({
      ...a,
      scores: a.scores ? JSON.parse(a.scores) : null
    }))

    // Build report
    const colorDist = {}
    const compDist = {}
    const grades = { A: 0, B: 0, C: 0, D: 0 }
    const dims = { color: [], composition: [], theme: [], expression: [] }

    parsed.forEach(a => {
      if (a.grade) grades[a.grade] = (grades[a.grade] || 0) + 1
      if (a.scores) {
        dims.color.push(a.scores.color)
        dims.composition.push(a.scores.composition)
        dims.theme.push(a.scores.theme)
        dims.expression.push(a.scores.expression)
        if (a.scores.colorDist) {
          Object.entries(a.scores.colorDist).forEach(([k, v]) => {
            colorDist[k] = (colorDist[k] || 0) + v
          })
        }
        if (a.scores.compositionType) {
          compDist[a.scores.compositionType] = (compDist[a.scores.compositionType] || 0) + 1
        }
      }
    })

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

    const report = {
      title: `${task.school_name} · ${task.grade_name}${task.class_name} · ${task.theme}`,
      generatedAt: new Date().toISOString(),
      task: {
        id: task.id,
        theme: task.theme,
        className: task.class_name,
        gradeName: task.grade_name,
        schoolName: task.school_name,
        status: task.status,
        createdAt: task.created_at
      },
      summary: {
        totalArtworks: parsed.length,
        gradeDistribution: grades,
        avgScore: Math.round(parsed.reduce((s, a) => s + (a.total_score || 0), 0) / (parsed.length || 1)),
        anomalyCount: parsed.filter(a => a.is_anomaly).length
      },
      dimensions: {
        color: { avg: avg(dims.color), min: Math.min(...dims.color), max: Math.max(...dims.color) },
        composition: { avg: avg(dims.composition), min: Math.min(...dims.composition), max: Math.max(...dims.composition) },
        theme: { avg: avg(dims.theme), min: Math.min(...dims.theme), max: Math.max(...dims.theme) },
        expression: { avg: avg(dims.expression), min: Math.min(...dims.expression), max: Math.max(...dims.expression) }
      },
      colorDistribution: colorDist,
      compositionDistribution: compDist,
      artworks: parsed.map(a => ({
        id: a.id,
        studentName: a.student_name,
        studentNo: a.student_no,
        title: a.title,
        grade: a.grade,
        totalScore: a.total_score,
        isAnomaly: !!a.is_anomaly,
        anomalyReason: a.anomaly_reason,
        scores: a.scores
      }))
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="report-${taskId}.json"`)
    res.json(report)
  } catch (err) {
    console.error('Error exporting task:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

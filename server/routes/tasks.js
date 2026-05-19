import { Router } from 'express'
import { z } from 'zod'
import { dbGet, dbAll, dbRun, dbExec } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { requireOwnership } from '../middleware/requireOwnership.js'

const createTaskSchema = z.object({
  classId: z.number().int().positive(),
  theme: z.string().min(1).max(200)
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
        (SELECT COUNT(*) FROM artworks a JOIN students s ON a.student_id = s.id
         WHERE (a.task_id = t.id OR (a.task_id IS NULL AND s.class_id = t.class_id))) as totalArtworks,
        (SELECT COUNT(*) FROM artworks a JOIN students s ON a.student_id = s.id
         WHERE (a.task_id = t.id OR (a.task_id IS NULL AND s.class_id = t.class_id)) AND a.is_anomaly = 1) as anomalyCount,
        (SELECT COUNT(*) FROM teacher_reviews tr
         JOIN artworks a ON tr.artwork_id = a.id
         JOIN students s ON a.student_id = s.id
         WHERE (a.task_id = t.id OR (a.task_id IS NULL AND s.class_id = t.class_id)) AND a.is_anomaly = 1) as reviewedCount
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

    const statsWhere = task.task_id !== undefined
      ? 'WHERE a.task_id = ?'
      : 'WHERE s.class_id = ?'
    const statsParam = task.task_id !== undefined ? req.params.id : task.class_id

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
      ${statsWhere}
    `, [statsParam])

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

    const { classId, theme } = parsed.data
    const result = await dbRun(
      `INSERT INTO analysis_tasks (class_id, teacher_id, theme, status) VALUES (?, ?, ?, 'pending')`,
      [classId, req.user.id, theme]
    )
    res.json({ id: result.lastID, status: 'pending' })
  } catch (err) {
    console.error('Error creating task:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

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

    await dbRun('UPDATE analysis_tasks SET status = ?, analysis_started_at = CURRENT_TIMESTAMP WHERE id = ?', ['processing', taskId])

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

const CONCURRENCY = 3

async function processAnalysis(taskId, classId, theme) {
  const { analyzeArtwork } = await import('../services/miniMax.js')
  const artworks = await dbAll(
    `SELECT a.* FROM artworks a
     JOIN students s ON a.student_id = s.id
     WHERE (a.task_id = ? OR (a.task_id IS NULL AND s.class_id = ?))`,
    [taskId, classId]
  )

  await dbRun(
    'UPDATE analysis_tasks SET total_count = ?, processed_count = 0 WHERE id = ?',
    [artworks.length, taskId]
  )

  let failedCount = 0

  for (let i = 0; i < artworks.length; i += CONCURRENCY) {
    const batch = artworks.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(art => analyzeArtwork(art.image_url, theme))
    )

    for (let j = 0; j < batch.length; j++) {
      const art = batch[j]
      const result = results[j]

      if (result.status === 'fulfilled') {
        await dbRun(
          `UPDATE artworks SET scores = ?, grade = ?, total_score = ?, is_anomaly = ?, anomaly_reason = ?, task_id = ? WHERE id = ?`,
          [JSON.stringify(result.value.scores), result.value.grade, result.value.totalScore, result.value.isAnomaly ? 1 : 0, result.value.reason, taskId, art.id]
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

  const status = failedCount === artworks.length ? 'failed' : 'completed'
  await dbRun('UPDATE analysis_tasks SET status = ?, analysis_completed_at = CURRENT_TIMESTAMP WHERE id = ?', [status, taskId])
}

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
      WHERE (a.task_id = ? OR (a.task_id IS NULL AND s.class_id = ?))
      ORDER BY a.total_score DESC
    `, [taskId, task.class_id])

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

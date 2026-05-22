import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取所有课题级教研议题
router.get('/', authMiddleware, async (req, res) => {
  try {
    const topics = await dbAll(`
      SELECT rt.*,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT s.id) as student_count,
        COUNT(DISTINCT a.id) as artwork_count,
        SUM(CASE WHEN a.is_anomaly = 1 THEN 1 ELSE 0 END) as anomaly_count,
        SUM(CASE WHEN a.is_anomaly = 1 AND tr.id IS NOT NULL THEN 1 ELSE 0 END) as reviewed_count
      FROM research_topics rt
      LEFT JOIN analysis_tasks t ON t.theme = rt.theme
      LEFT JOIN classes c ON c.id = t.class_id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN artworks a ON a.student_id = s.id AND a.task_id = t.id
      LEFT JOIN teacher_reviews tr ON tr.artwork_id = a.id
      GROUP BY rt.id
      ORDER BY rt.theme
    `)

    const result = topics.map(t => ({
      id: t.id,
      theme: t.theme,
      research_conclusion: t.research_conclusion || '',
      teaching_reference: t.teaching_reference ? JSON.parse(t.teaching_reference) : null,
      task_count: t.task_count || 0,
      student_count: t.student_count || 0,
      artwork_count: t.artwork_count || 0,
      anomaly_count: t.anomaly_count || 0,
      reviewed_count: t.reviewed_count || 0,
      closure_status: getClosureStatus(t.anomaly_count || 0, t.reviewed_count || 0),
      created_at: t.created_at,
      updated_at: t.updated_at
    }))

    res.json(result)
  } catch (err) {
    console.error('Error fetching research topics:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取单个课题下的关注作品（所有班级）
router.get('/:theme/anomaly-artworks', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.params
    const artworks = await dbAll(`
      SELECT a.*, s.name as student_name, s.student_no,
             c.name as class_name, t.class_id
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON c.id = s.class_id
      JOIN analysis_tasks t ON t.id = a.task_id
      WHERE t.theme = ? AND a.is_anomaly = 1
      ORDER BY c.name, s.name
    `, [theme])

    res.json(artworks.map(a => ({
      ...a,
      scores: a.scores ? JSON.parse(a.scores) : null
    })))
  } catch (err) {
    console.error('Error fetching anomaly artworks:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 保存教研结论
router.patch('/:theme', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.params
    const { research_conclusion } = req.body

    const existing = await dbGet('SELECT id FROM research_topics WHERE theme = ?', [theme])
    if (existing) {
      await dbRun(
        `UPDATE research_topics SET research_conclusion = ?, updated_at = CURRENT_TIMESTAMP WHERE theme = ?`,
        [research_conclusion || null, theme]
      )
    } else {
      await dbRun(
        `INSERT INTO research_topics (theme, research_conclusion) VALUES (?, ?)`,
        [theme, research_conclusion || null]
      )
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Error saving research conclusion:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 生成教学参考（AI）
router.post('/:theme/teaching-reference', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.params

    // 获取该课题所有班级的统计数据
    const stats = await dbGet(`
      SELECT
        COUNT(DISTINCT a.id) as total,
        AVG(a.total_score) as avgScore,
        SUM(CASE WHEN a.is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount
      FROM artworks a
      JOIN analysis_tasks t ON t.id = a.task_id
      WHERE t.theme = ? AND a.total_score IS NOT NULL
    `, [theme])

    const colorDist = await dbAll(`
      SELECT a.scores
      FROM artworks a
      JOIN analysis_tasks t ON t.id = a.task_id
      WHERE t.theme = ? AND a.scores IS NOT NULL
      LIMIT 50
    `, [theme])

    const { generateTeachingSuggestions } = await import('../services/miniMax.js')
    const suggestion = await generateTeachingSuggestions(
      theme,
      '全校',
      [{ label: '色彩运用', avg: 0, min: 0, max: 0 }, { label: '构图完整度', avg: 0, min: 0, max: 0 }, { label: '主题契合度', avg: 0, min: 0, max: 0 }, { label: '造型表现力', avg: 0, min: 0, max: 0 }],
      [],
      [],
      { A: 0, B: 0, C: 0, D: 0 },
      stats.total || 0,
      stats.anomalyCount || 0
    )

    const teaching_reference = suggestion ? { content: suggestion, generated_at: new Date().toISOString() } : null

    const existing = await dbGet('SELECT id FROM research_topics WHERE theme = ?', [theme])
    if (existing) {
      await dbRun(
        `UPDATE research_topics SET teaching_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE theme = ?`,
        [teaching_reference ? JSON.stringify(teaching_reference) : null, theme]
      )
    } else {
      await dbRun(
        `INSERT INTO research_topics (theme, teaching_reference) VALUES (?, ?)`,
        [theme, teaching_reference ? JSON.stringify(teaching_reference) : null]
      )
    }

    res.json({ ok: true, teaching_reference })
  } catch (err) {
    console.error('Error generating teaching reference:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取课题列表（供下拉选择）
router.get('/themes', authMiddleware, async (req, res) => {
  try {
    const themes = await dbAll(`
      SELECT DISTINCT theme FROM analysis_tasks WHERE theme IS NOT NULL ORDER BY theme
    `)
    res.json(themes.map(t => t.theme))
  } catch (err) {
    console.error('Error fetching themes:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 创建课题教研议题
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.body
    if (!theme) return res.status(400).json({ error: 'theme is required' })

    const existing = await dbGet('SELECT id FROM research_topics WHERE theme = ?', [theme])
    if (existing) return res.status(409).json({ error: '该课题已存在' })

    const result = await dbRun(
      `INSERT INTO research_topics (theme) VALUES (?)`,
      [theme]
    )
    res.json({ id: result.lastID, theme })
  } catch (err) {
    console.error('Error creating research topic:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

function getClosureStatus(anomalyCount, reviewedCount) {
  if (anomalyCount === 0) return { label: '已完成', color: 'green', desc: '无关注作品' }
  if (reviewedCount === 0) return { label: '未开始', color: 'red', desc: '待教师释义' }
  if (reviewedCount >= anomalyCount) return { label: '已完成', color: 'green', desc: '全部已释义' }
  return { label: '进行中', color: 'amber', desc: `部分已释义(${reviewedCount}/${anomalyCount})` }
}

export default router

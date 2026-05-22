import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

// 班级列表 (可选按年级筛选)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { gradeId } = req.query
    let sql = `SELECT c.*, g.name as grade_name, g.id as grade_id,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count,
      (SELECT GROUP_CONCAT(u.name, '、') FROM teacher_classes tc JOIN users u ON tc.teacher_id = u.id WHERE tc.class_id = c.id) as teacher_names,
      (SELECT GROUP_CONCAT(tc.teacher_id) FROM teacher_classes tc WHERE tc.class_id = c.id) as teacher_ids
      FROM classes c
      JOIN grades g ON c.grade_id = g.id`
    const params = []
    if (gradeId) { sql += ' WHERE c.grade_id = ?'; params.push(gradeId) }
    sql += ' ORDER BY g.name, c.name'
    const rows = await dbAll(sql, params)
    // Parse teacher_ids from comma-separated string
    rows.forEach(cls => {
      cls.teacher_ids = cls.teacher_ids ? cls.teacher_ids.split(',').map(Number) : []
    })
    res.json(rows)
  } catch (err) {
    console.error('Error fetching classes:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取单个班级(含学生数)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const cls = await dbGet(`
      SELECT c.*, g.name as grade_name, g.id as grade_id
      FROM classes c
      JOIN grades g ON c.grade_id = g.id
      WHERE c.id = ?`, [req.params.id])
    if (!cls) return res.status(404).json({ error: 'Class not found' })

    const studentCount = await dbGet('SELECT COUNT(*) as count FROM students WHERE class_id = ?', [req.params.id])
    const teachers = await dbAll(`
      SELECT u.id, u.name, u.role FROM teacher_classes tc
      JOIN users u ON tc.teacher_id = u.id
      WHERE tc.class_id = ?`, [req.params.id])

    res.json({
      ...cls,
      student_count: studentCount.count,
      teachers
    })
  } catch (err) {
    console.error('Error fetching class:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 新增班级
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name) return res.status(400).json({ error: 'name is required' })
    if (name.length > 50) return res.status(400).json({ error: 'name too long (max 50)' })

    const gradeId = req.body.grade_id ? Number(req.body.grade_id) : NaN
    if (!Number.isInteger(gradeId) || gradeId <= 0) {
      return res.status(400).json({ error: 'grade_id is required (integer)' })
    }

    const grade = await dbGet('SELECT id FROM grades WHERE id = ?', [gradeId])
    if (!grade) return res.status(400).json({ error: 'grade_id does not exist' })

    const teacherIds = req.body.teacher_ids || []
    if (teacherIds.length > 0) {
      // Validate all teachers exist
      const placeholders = teacherIds.map(() => '?').join(',')
      const teachers = await dbAll(
        `SELECT id FROM users WHERE id IN (${placeholders}) AND role IN ("teacher","admin")`,
        teacherIds
      )
      if (teachers.length !== teacherIds.length) {
        return res.status(400).json({ error: '部分教师不存在' })
      }
    }

    const result = await dbRun(
      'INSERT INTO classes (grade_id, name) VALUES (?, ?)',
      [gradeId, name]
    )
    const classId = result.lastID

    // Add teacher relationships
    for (const teacherId of teacherIds) {
      await dbRun(
        'INSERT OR IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)',
        [teacherId, classId]
      )
    }

    const created = await dbGet(`
      SELECT c.*, g.name as grade_name, g.id as grade_id
      FROM classes c JOIN grades g ON c.grade_id = g.id WHERE c.id = ?`, [classId])
    const teachers = await dbAll(`
      SELECT u.id, u.name, u.role FROM teacher_classes tc
      JOIN users u ON tc.teacher_id = u.id WHERE tc.class_id = ?`, [classId])

    res.status(201).json({ ...created, teachers, teacher_ids: teacherIds })
  } catch (err) {
    console.error('Error creating class:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 更新班级
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const existing = await dbGet('SELECT id FROM classes WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Class not found' })

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name) return res.status(400).json({ error: 'name is required' })

    const gradeId = req.body.grade_id ? Number(req.body.grade_id) : NaN
    if (!Number.isInteger(gradeId) || gradeId <= 0) {
      return res.status(400).json({ error: 'grade_id is required (integer)' })
    }

    const grade = await dbGet('SELECT id FROM grades WHERE id = ?', [gradeId])
    if (!grade) return res.status(400).json({ error: 'grade_id does not exist' })

    const teacherIds = req.body.teacher_ids || []
    if (teacherIds.length > 0) {
      const placeholders = teacherIds.map(() => '?').join(',')
      const teachers = await dbAll(
        `SELECT id FROM users WHERE id IN (${placeholders}) AND role IN ("teacher","admin")`,
        teacherIds
      )
      if (teachers.length !== teacherIds.length) {
        return res.status(400).json({ error: '部分教师不存在' })
      }
    }

    await dbRun(
      'UPDATE classes SET grade_id = ?, name = ? WHERE id = ?',
      [gradeId, name, req.params.id]
    )

    // Replace teacher relationships
    await dbRun('DELETE FROM teacher_classes WHERE class_id = ?', [req.params.id])
    for (const teacherId of teacherIds) {
      await dbRun(
        'INSERT OR IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)',
        [teacherId, req.params.id]
      )
    }

    const updated = await dbGet(`
      SELECT c.*, g.name as grade_name, g.id as grade_id
      FROM classes c JOIN grades g ON c.grade_id = g.id WHERE c.id = ?`, [req.params.id])
    const teachers = await dbAll(`
      SELECT u.id, u.name, u.role FROM teacher_classes tc
      JOIN users u ON tc.teacher_id = u.id WHERE tc.class_id = ?`, [req.params.id])

    res.json({ ...updated, teachers, teacher_ids: teacherIds })
  } catch (err) {
    console.error('Error updating class:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 删除班级(有学生时禁止删除)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const existing = await dbGet('SELECT id FROM classes WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Class not found' })

    const studentCount = await dbGet('SELECT COUNT(*) as count FROM students WHERE class_id = ?', [req.params.id])
    if (studentCount.count > 0) {
      return res.status(409).json({ error: `该班级有 ${studentCount.count} 名学生,请先处理学生后再删除班级` })
    }

    // Remove teacher relationships first
    await dbRun('DELETE FROM teacher_classes WHERE class_id = ?', [req.params.id])
    await dbRun('DELETE FROM classes WHERE id = ?', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error('Error deleting class:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 班级阶段性教学建议（基于最近 N 个已完成 task 累积生成，缓存 7 天）
router.get('/:id/teaching-suggestion', authMiddleware, async (req, res) => {
  try {
    const classId = Number(req.params.id)
    if (!Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({ error: 'invalid class id' })
    }

    const refresh = req.query.refresh === 'true'
    const windowSize = Math.min(Math.max(Number(req.query.windowSize) || 5, 1), 12)

    const cls = await dbGet(`
      SELECT c.id, c.name, g.name as grade_name
      FROM classes c JOIN grades g ON c.grade_id = g.id
      WHERE c.id = ?
    `, [classId])
    if (!cls) return res.status(404).json({ error: 'Class not found' })

    // 拉最近 N 个已完成 task
    const tasks = await dbAll(`
      SELECT id, theme, analysis_completed_at, created_at
      FROM analysis_tasks
      WHERE class_id = ? AND status = 'completed'
      ORDER BY COALESCE(analysis_completed_at, created_at) DESC
      LIMIT ?
    `, [classId, windowSize])

    if (!tasks.length) {
      return res.status(400).json({ error: '该班级暂无已完成的分析任务，无法生成教学建议' })
    }

    // 按时间正序展开
    const orderedTasks = [...tasks].reverse()
    const taskIds = orderedTasks.map(t => t.id)
    const placeholders = taskIds.map(() => '?').join(',')

    const artworks = await dbAll(`
      SELECT id, task_id, scores, grade, is_anomaly
      FROM artworks WHERE task_id IN (${placeholders})
    `, taskIds)

    // 解析 scores
    const parsed = artworks.map(a => ({
      ...a,
      scores: a.scores ? (() => { try { return JSON.parse(a.scores) } catch { return null } })() : null
    }))

    // 按 task 分组聚合
    const colorKeys = ['red','orange','yellow','green','cyan','blue','purple','pink','brown','gray','black']
    const colorNames = { red:'红', orange:'橙', yellow:'黄', green:'绿', cyan:'青', blue:'蓝', purple:'紫', pink:'粉', brown:'棕', gray:'灰', black:'黑' }

    const cumColor = {}
    const cumComp = { '居中式': 0, '满幅式': 0, '分割式': 0, '留白式': 0 }
    const cumGrades = { A: 0, B: 0, C: 0, D: 0 }
    let cumCount = 0
    let cumCompTotal = 0

    const timeline = orderedTasks.map(t => {
      const works = parsed.filter(a => a.task_id === t.id)
      const dims = { color: [], composition: [], theme: [], expression: [] }
      works.forEach(a => {
        if (a.grade && cumGrades[a.grade] !== undefined) cumGrades[a.grade]++
        cumCount++
        if (a.scores) {
          dims.color.push(a.scores.color)
          dims.composition.push(a.scores.composition)
          dims.theme.push(a.scores.theme)
          dims.expression.push(a.scores.expression)
          if (a.scores.colorDist) {
            Object.entries(a.scores.colorDist).forEach(([k, v]) => {
              cumColor[k] = (cumColor[k] || 0) + Number(v || 0)
            })
          }
          if (a.scores.compositionType && cumComp[a.scores.compositionType] !== undefined) {
            cumComp[a.scores.compositionType]++
            cumCompTotal++
          }
        }
      })
      const avg = arr => arr.length ? Math.round(arr.reduce((s, n) => s + n, 0) / arr.length) : 0
      return {
        task_id: t.id,
        theme: t.theme,
        date: t.analysis_completed_at || t.created_at,
        count: works.length,
        dims: {
          color: avg(dims.color),
          composition: avg(dims.composition),
          theme: avg(dims.theme),
          expression: avg(dims.expression)
        }
      }
    })

    const colorTrend = colorKeys
      .map(k => ({ color: colorNames[k], pct: cumCount ? Math.round(cumColor[k] / cumCount) : 0 }))
      .filter(c => c.pct > 0)
      .sort((a, b) => b.pct - a.pct)
    const compTrend = Object.entries(cumComp)
      .map(([type, n]) => ({ type, count: n, pct: cumCompTotal ? Math.round(n / cumCompTotal * 100) : 0 }))
      .filter(c => c.count > 0)
      .sort((a, b) => b.pct - a.pct)

    const classLabel = `${cls.grade_name}${cls.name}`

    // 命中未过期缓存：跳过 AI 调用，沿用旧文本
    let suggestion = null
    let source = 'ai'
    let generatedAt = null
    let expiresAt = null

    if (!refresh) {
      const cached = await dbGet(`
        SELECT content, generated_at, expires_at, source
        FROM class_teaching_suggestions
        WHERE class_id = ? AND expires_at > datetime('now')
        ORDER BY generated_at DESC LIMIT 1
      `, [classId])
      if (cached) {
        suggestion = cached.content
        source = 'cached'
        generatedAt = cached.generated_at
        expiresAt = cached.expires_at
      }
    }

    // 未命中缓存：调 AI 生成
    if (!suggestion) {
      const { generateClassLongitudinalSuggestion } = await import('../services/miniMax.js')
      suggestion = await generateClassLongitudinalSuggestion(classLabel, timeline, colorTrend, compTrend, cumGrades)
      source = 'ai'

      // 兜底：本地模板
      if (!suggestion) {
        source = 'local'
        const last = timeline[timeline.length - 1]
        const first = timeline[0]
        const deltas = ['color','composition','theme','expression'].map(k => ({
          k, label: { color: '色彩', composition: '构图', theme: '主题', expression: '造型' }[k],
          delta: last.dims[k] - first.dims[k]
        }))
        const rising = deltas.filter(d => d.delta >= 3).map(d => d.label).join('、') || '尚不明显'
        const weak = [...deltas].sort((a, b) => a.delta - b.delta)[0]
        suggestion = `近 ${timeline.length} 次作业横向看，「${rising}」呈持续上升态势；「${weak.label}」的进步相对最缓（从 ${first.dims[weak.k]} 到 ${last.dims[weak.k]}）。下一阶段可在该维度增加针对性练习——例如保留前 5 分钟做"画面呼吸的空间"观察，让学生先看再画。这只是一份辅助参考，是否采纳、节奏如何，由你结合课堂实际自行判断。`
      }

      const now = new Date()
      const exp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      generatedAt = now.toISOString().replace('T', ' ').slice(0, 19)
      expiresAt = exp.toISOString().replace('T', ' ').slice(0, 19)
      await dbRun(
        `INSERT INTO class_teaching_suggestions (class_id, content, task_ids, window_start, window_end, generated_at, expires_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [classId, suggestion, JSON.stringify(taskIds), timeline[0].date, timeline[timeline.length - 1].date, generatedAt, expiresAt, source]
      )
    }

    res.json({
      source,
      content: suggestion,
      task_ids: taskIds,
      timeline,
      colorTrend,
      compTrend,
      gradeTrend: cumGrades,
      window_start: timeline[0].date,
      window_end: timeline[timeline.length - 1].date,
      generated_at: generatedAt,
      expires_at: expiresAt,
      class: { id: cls.id, name: cls.name, grade_name: cls.grade_name }
    })
  } catch (err) {
    console.error('Error generating class teaching suggestion:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

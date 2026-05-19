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
      u.name as teacher_name,
      (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
      FROM classes c
      JOIN grades g ON c.grade_id = g.id
      LEFT JOIN users u ON c.teacher_id = u.id`
    const params = []
    if (gradeId) { sql += ' WHERE c.grade_id = ?'; params.push(gradeId) }
    sql += ' ORDER BY g.name, c.name'
    const rows = await dbAll(sql, params)
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
      SELECT c.*, g.name as grade_name, g.id as grade_id,
        u.name as teacher_name
      FROM classes c
      JOIN grades g ON c.grade_id = g.id
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.id = ?`, [req.params.id])
    if (!cls) return res.status(404).json({ error: 'Class not found' })
    const studentCount = await dbGet('SELECT COUNT(*) as count FROM students WHERE class_id = ?', [req.params.id])
    res.json({ ...cls, student_count: studentCount.count })
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

    let teacherId = null
    if (req.body.teacher_id) {
      const teacher = await dbGet('SELECT id FROM users WHERE id = ? AND role IN ("teacher","admin")', [req.body.teacher_id])
      if (teacher) teacherId = teacher.id
    }

    const result = await dbRun(
      'INSERT INTO classes (grade_id, name, teacher_id) VALUES (?, ?, ?)',
      [gradeId, name, teacherId]
    )
    const created = await dbGet(`
      SELECT c.*, g.name as grade_name, g.id as grade_id, u.name as teacher_name
      FROM classes c JOIN grades g ON c.grade_id = g.id
      LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = ?`, [result.lastID])
    res.status(201).json(created)
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

    let teacherId = null
    if (req.body.teacher_id) {
      const teacher = await dbGet('SELECT id FROM users WHERE id = ? AND role IN ("teacher","admin")', [req.body.teacher_id])
      if (teacher) teacherId = teacher.id
    }

    await dbRun(
      'UPDATE classes SET grade_id = ?, name = ?, teacher_id = ? WHERE id = ?',
      [gradeId, name, teacherId, req.params.id]
    )
    const updated = await dbGet(`
      SELECT c.*, g.name as grade_name, g.id as grade_id, u.name as teacher_name
      FROM classes c JOIN grades g ON c.grade_id = g.id
      LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = ?`, [req.params.id])
    res.json(updated)
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

    await dbRun('DELETE FROM classes WHERE id = ?', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error('Error deleting class:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

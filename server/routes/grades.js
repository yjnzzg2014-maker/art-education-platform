import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

// 年级列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const schoolId = req.query.schoolId
    let sql = `SELECT g.*, s.name as school_name,
      (SELECT COUNT(*) FROM classes c WHERE c.grade_id = g.id) as class_count
      FROM grades g
      JOIN schools s ON g.school_id = s.id`
    const params = []
    if (schoolId) { sql += ' WHERE g.school_id = ?'; params.push(schoolId) }
    sql += ' ORDER BY g.name'
    const rows = await dbAll(sql, params)

    if (req.query.withClasses === '1') {
      const classes = await dbAll(`
        SELECT c.*,
          (SELECT GROUP_CONCAT(u.name, '、') FROM teacher_classes tc JOIN users u ON tc.teacher_id = u.id WHERE tc.class_id = c.id) as teacher_names,
          (SELECT GROUP_CONCAT(tc.teacher_id) FROM teacher_classes tc WHERE tc.class_id = c.id) as teacher_ids,
          (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
        FROM classes c
        ORDER BY c.name
      `)
      // Parse teacher_ids from comma-separated string
      classes.forEach(cls => {
        cls.teacher_ids = cls.teacher_ids ? cls.teacher_ids.split(',').map(Number) : []
      })
      const classesByGrade = {}
      for (const cls of classes) {
        if (!classesByGrade[cls.grade_id]) classesByGrade[cls.grade_id] = []
        classesByGrade[cls.grade_id].push(cls)
      }
      for (const grade of rows) {
        grade.classes = classesByGrade[grade.id] || []
      }
    }

    res.json(rows)
  } catch (err) {
    console.error('Error fetching grades:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取单个年级(含班级列表)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const grade = await dbGet(
      `SELECT g.*, s.name as school_name FROM grades g JOIN schools s ON g.school_id = s.id WHERE g.id = ?`,
      [req.params.id]
    )
    if (!grade) return res.status(404).json({ error: 'Grade not found' })
    const classes = await dbAll(
      `SELECT c.*,
        (SELECT GROUP_CONCAT(u.name, '、') FROM teacher_classes tc JOIN users u ON tc.teacher_id = u.id WHERE tc.class_id = c.id) as teacher_names,
        (SELECT GROUP_CONCAT(tc.teacher_id) FROM teacher_classes tc WHERE tc.class_id = c.id) as teacher_ids
       FROM classes c
       WHERE c.grade_id = ? ORDER BY c.name`,
      [req.params.id]
    )
    classes.forEach(cls => {
      cls.teacher_ids = cls.teacher_ids ? cls.teacher_ids.split(',').map(Number) : []
    })
    res.json({ ...grade, classes })
  } catch (err) {
    console.error('Error fetching grade:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 新增年级
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name) return res.status(400).json({ error: 'name is required' })
    if (name.length > 50) return res.status(400).json({ error: 'name too long (max 50)' })

    const schoolId = req.body.school_id || 1
    const existing = await dbGet('SELECT id FROM schools WHERE id = ?', [schoolId])
    if (!existing) return res.status(400).json({ error: 'school_id does not exist' })

    const result = await dbRun(
      'INSERT INTO grades (school_id, name) VALUES (?, ?)',
      [schoolId, name]
    )
    const created = await dbGet('SELECT * FROM grades WHERE id = ?', [result.lastID])
    res.status(201).json(created)
  } catch (err) {
    console.error('Error creating grade:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 更新年级
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const existing = await dbGet('SELECT id FROM grades WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Grade not found' })

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    if (!name) return res.status(400).json({ error: 'name is required' })

    await dbRun('UPDATE grades SET name = ? WHERE id = ?', [name, req.params.id])
    const updated = await dbGet('SELECT * FROM grades WHERE id = ?', [req.params.id])
    res.json(updated)
  } catch (err) {
    console.error('Error updating grade:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 删除年级(有班级时禁止删除)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const existing = await dbGet('SELECT id FROM grades WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'Grade not found' })

    const classCount = await dbGet('SELECT COUNT(*) as count FROM classes WHERE grade_id = ?', [req.params.id])
    if (classCount.count > 0) {
      return res.status(409).json({ error: `该年级有 ${classCount.count} 个班级,请先删除班级后再删除年级` })
    }

    await dbRun('DELETE FROM grades WHERE id = ?', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error('Error deleting grade:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

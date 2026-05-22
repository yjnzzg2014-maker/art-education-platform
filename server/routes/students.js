import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 已经以 / 或 http(s):// 开头的视为绝对/外部路径，不再加 /api/upload/ 前缀
const prefixImageUrl = (url) => {
  if (!url) return null
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return url
  return `/api/upload/${url}`
}

// 获取学生画像
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const student = await dbGet(`
      SELECT s.*, c.name as class_name, g.name as grade_name
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN grades g ON c.grade_id = g.id
      WHERE s.id = ?
    `, [req.params.id])

    if (!student) return res.status(404).json({ error: 'Student not found' })

    const [artworks, stats] = await Promise.all([
      dbAll('SELECT * FROM artworks WHERE student_id = ? ORDER BY upload_time DESC', [req.params.id]),
      dbGet(`
        SELECT
          COUNT(*) as total,
          AVG(total_score) as avgScore,
          SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) as gradeA,
          SUM(CASE WHEN grade = 'B' THEN 1 ELSE 0 END) as gradeB,
          SUM(CASE WHEN grade = 'C' THEN 1 ELSE 0 END) as gradeC,
          SUM(CASE WHEN grade = 'D' THEN 1 ELSE 0 END) as gradeD
        FROM artworks WHERE student_id = ?
      `, [req.params.id])
    ])

    res.json({
      ...student,
      artworks: artworks.map(a => ({
        ...a,
        image_url: prefixImageUrl(a.image_url),
        scores: a.scores ? JSON.parse(a.scores) : null
      })),
      stats
    })
  } catch (err) {
    console.error('Error fetching student:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取学生作品
router.get('/:id/works', authMiddleware, async (req, res) => {
  try {
    const artworks = await dbAll(
      'SELECT * FROM artworks WHERE student_id = ? ORDER BY upload_time DESC',
      [req.params.id]
    )
    res.json(artworks.map(a => ({
      ...a,
      image_url: prefixImageUrl(a.image_url),
      scores: a.scores ? JSON.parse(a.scores) : null
    })))
  } catch (err) {
    console.error('Error fetching student works:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取所有学生列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { classId, page = 1, limit = 50 } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(2000, Math.max(1, parseInt(limit)))
    const offset = (pageNum - 1) * limitNum

    let sql = `
      SELECT s.*, c.name as class_name, g.name as grade_name,
        (SELECT grade FROM artworks WHERE student_id = s.id ORDER BY upload_time DESC LIMIT 1) as latest_grade,
        (SELECT total_score FROM artworks WHERE student_id = s.id ORDER BY upload_time DESC LIMIT 1) as latest_score,
        (SELECT COUNT(*) FROM artworks WHERE student_id = s.id) as artwork_count
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN grades g ON c.grade_id = g.id
    `
    let countSql = `SELECT COUNT(*) as total FROM students s JOIN classes c ON s.class_id = c.id`
    const params = []
    const countParams = []

    // 教师只能查看自己负责的班级的学生
    if (req.user.role === 'teacher') {
      sql += ' WHERE c.id IN (SELECT class_id FROM teacher_classes WHERE teacher_id = ?)'
      countSql += ' WHERE c.id IN (SELECT class_id FROM teacher_classes WHERE teacher_id = ?)'
      params.push(req.user.id)
      countParams.push(req.user.id)
    }

    if (classId) {
      if (req.user.role === 'teacher') {
        sql += ' AND s.class_id = ?'
        countSql += ' AND s.class_id = ?'
      } else {
        sql += ' WHERE s.class_id = ?'
        countSql += ' WHERE s.class_id = ?'
      }
      params.push(classId)
      countParams.push(classId)
    }

    sql += ` ORDER BY c.name, s.name LIMIT ? OFFSET ?`
    params.push(limitNum, offset)

    const [students, countResult] = await Promise.all([
      dbAll(sql, params),
      dbGet(countSql, countParams)
    ])

    res.json({
      data: students,
      total: countResult.total,
      page: pageNum,
      limit: limitNum
    })
  } catch (err) {
    console.error('Error fetching students:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 创建学生（管理员和教师都可以）
router.post('/', authMiddleware, async (req, res) => {
  // 管理员可以创建任何班级学生，教师只能在自己负责的班级创建
  if (req.user.role === 'teacher') {
    const classInfo = await dbGet(`
      SELECT 1 FROM teacher_classes WHERE teacher_id = ? AND class_id = ?
    `, [req.user.id, req.body.class_id])
    if (!classInfo) {
      return res.status(403).json({ error: '只能在自己负责的班级创建学生' })
    }
  }
  try {
    const { name, student_no, class_id, gender, birth_date } = req.body
    if (!name || !class_id) {
      return res.status(400).json({ error: '姓名和班级不能为空' })
    }
    const result = await dbRun(
      `INSERT INTO students (name, student_no, class_id, gender, birth_date) VALUES (?, ?, ?, ?, ?)`,
      [name, student_no || null, class_id, gender || null, birth_date || null]
    )
    res.status(201).json({ id: result.lastID, message: '学生创建成功' })
  } catch (err) {
    console.error('Error creating student:', err)
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '学号已存在' })
    }
    res.status(500).json({ error: 'Internal error' })
  }
})

// 批量创建学生（管理员和教师都可以）
router.post('/batch', authMiddleware, async (req, res) => {
  // 管理员可以创建任何班级学生，教师只能在自己负责的班级创建
  if (req.user.role === 'teacher') {
    const classInfo = await dbGet(`
      SELECT 1 FROM teacher_classes WHERE teacher_id = ? AND class_id = ?
    `, [req.user.id, req.body.class_id])
    if (!classInfo) {
      return res.status(403).json({ error: '只能在自己负责的班级创建学生' })
    }
  }
  try {
    const { students, class_id } = req.body
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'students 必须是非空数组' })
    }
    if (!class_id) {
      return res.status(400).json({ error: 'class_id 不能为空' })
    }

    const results = { success: 0, failed: 0, errors: [] }
    for (const s of students) {
      if (!s.name) {
        results.failed++
        results.errors.push('姓名为空')
        continue
      }
      try {
        await dbRun(
          `INSERT INTO students (name, student_no, class_id, gender, birth_date) VALUES (?, ?, ?, ?, ?)`,
          [s.name, s.student_no || null, class_id, s.gender || null, s.birth_date || null]
        )
        results.success++
      } catch (err) {
        results.failed++
        if (err.message.includes('UNIQUE constraint')) {
          results.errors.push(`学号 ${s.student_no || s.name} 已存在`)
        } else {
          results.errors.push(`${s.name} 创建失败`)
        }
      }
    }
    res.status(201).json(results)
  } catch (err) {
    console.error('Error batch creating students:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 更新学生（仅管理员）
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可更新学生' })
  }
  try {
    const { name, student_no, class_id, gender, birth_date, parent_phone, address } = req.body
    const student = await dbGet('SELECT id FROM students WHERE id = ?', [req.params.id])
    if (!student) return res.status(404).json({ error: '学生不存在' })

    await dbRun(
      `UPDATE students SET name = ?, student_no = ?, class_id = ?, gender = ?, birth_date = ?, parent_phone = ?, address = ? WHERE id = ?`,
      [name, student_no || null, class_id, gender || null, birth_date || null, parent_phone || null, address || null, req.params.id]
    )
    res.json({ message: '学生更新成功' })
  } catch (err) {
    console.error('Error updating student:', err)
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: '学号已存在' })
    }
    res.status(500).json({ error: 'Internal error' })
  }
})

// 删除学生（仅管理员）
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '仅管理员可删除学生' })
  }
  try {
    const student = await dbGet('SELECT id FROM students WHERE id = ?', [req.params.id])
    if (!student) return res.status(404).json({ error: '学生不存在' })

    const artworkCount = await dbGet('SELECT COUNT(*) as count FROM artworks WHERE student_id = ?', [req.params.id])
    if (artworkCount.count > 0) {
      return res.status(409).json({ error: `该学生有 ${artworkCount.count} 件作品,请先删除作品` })
    }

    await dbRun('DELETE FROM students WHERE id = ?', [req.params.id])
    res.json({ message: '学生删除成功' })
  } catch (err) {
    console.error('Error deleting student:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

import { Router } from 'express'
import { dbGet, dbAll } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

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
      artworks: artworks.map(a => ({ ...a, scores: a.scores ? JSON.parse(a.scores) : null })),
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
    res.json(artworks.map(a => ({ ...a, scores: a.scores ? JSON.parse(a.scores) : null })))
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
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
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

    if (classId) {
      sql += ' WHERE s.class_id = ?'
      countSql += ' WHERE s.class_id = ?'
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

export default router

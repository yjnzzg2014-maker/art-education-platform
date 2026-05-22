import { Router } from 'express'
import { dbGet, dbAll } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 班级统计
router.get('/class/:id', authMiddleware, async (req, res) => {
  try {
    const stats = await dbGet(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) as gradeA,
        SUM(CASE WHEN grade = 'B' THEN 1 ELSE 0 END) as gradeB,
        SUM(CASE WHEN grade = 'C' THEN 1 ELSE 0 END) as gradeC,
        SUM(CASE WHEN grade = 'D' THEN 1 ELSE 0 END) as gradeD,
        SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount,
        AVG(total_score) as avgScore
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE s.class_id = ?
    `, [req.params.id])
    res.json(stats)
  } catch (err) {
    console.error('Error fetching class stats:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 年级统计
router.get('/grade/:id', authMiddleware, async (req, res) => {
  try {
    const classes = await dbAll('SELECT id FROM classes WHERE grade_id = ?', [req.params.id])
    const classIds = classes.map(c => c.id)

    if (classIds.length === 0) return res.json({ total: 0 })

    const placeholders = classIds.map(() => '?').join(',')
    const stats = await dbGet(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) as gradeA,
        SUM(CASE WHEN grade = 'B' THEN 1 ELSE 0 END) as gradeB,
        SUM(CASE WHEN grade = 'C' THEN 1 ELSE 0 END) as gradeC,
        SUM(CASE WHEN grade = 'D' THEN 1 ELSE 0 END) as gradeD,
        AVG(total_score) as avgScore
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE s.class_id IN (${placeholders})
    `, classIds)
    res.json(stats)
  } catch (err) {
    console.error('Error fetching grade stats:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 学校统计
router.get('/school/:id', authMiddleware, async (req, res) => {
  try {
    const grades = await dbAll('SELECT id FROM grades WHERE school_id = ?', [req.params.id])
    const gradeIds = grades.map(g => g.id)

    if (gradeIds.length === 0) return res.json({ total: 0 })

    const classes = await dbAll(
      'SELECT id FROM classes WHERE grade_id IN (' + gradeIds.map(() => '?').join(',') + ')',
      gradeIds
    )
    const classIds = classes.map(c => c.id)

    if (classIds.length === 0) return res.json({ total: 0 })

    const placeholders = classIds.map(() => '?').join(',')
    const stats = await dbGet(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) as gradeA,
        SUM(CASE WHEN grade = 'B' THEN 1 ELSE 0 END) as gradeB,
        SUM(CASE WHEN grade = 'C' THEN 1 ELSE 0 END) as gradeC,
        SUM(CASE WHEN grade = 'D' THEN 1 ELSE 0 END) as gradeD,
        AVG(total_score) as avgScore,
        SUM(CASE WHEN is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE s.class_id IN (${placeholders})
    `, classIds)
    res.json(stats)
  } catch (err) {
    console.error('Error fetching school stats:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 学校下各年级分类统计
router.get('/school/:id/breakdown', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT g.id, g.name,
        COUNT(DISTINCT c.id) as classCount,
        COUNT(DISTINCT s.id) as studentCount,
        COUNT(a.id) as artworkCount,
        AVG(a.total_score) as avgScore,
        SUM(CASE WHEN a.grade = 'A' THEN 1 ELSE 0 END) as gradeA,
        SUM(CASE WHEN a.grade = 'B' THEN 1 ELSE 0 END) as gradeB,
        SUM(CASE WHEN a.grade = 'C' THEN 1 ELSE 0 END) as gradeC,
        SUM(CASE WHEN a.grade = 'D' THEN 1 ELSE 0 END) as gradeD,
        SUM(CASE WHEN a.is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount
      FROM grades g
      LEFT JOIN classes c ON c.grade_id = g.id
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN artworks a ON a.student_id = s.id
      WHERE g.school_id = ?
      GROUP BY g.id
      ORDER BY g.name
    `, [req.params.id])
    res.json(rows)
  } catch (err) {
    console.error('Error fetching school breakdown:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 年级下各班级分类统计
router.get('/grade/:id/breakdown', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT c.id, c.name,
        COUNT(DISTINCT s.id) as studentCount,
        COUNT(a.id) as artworkCount,
        AVG(a.total_score) as avgScore,
        SUM(CASE WHEN a.grade = 'A' THEN 1 ELSE 0 END) as gradeA,
        SUM(CASE WHEN a.grade = 'B' THEN 1 ELSE 0 END) as gradeB,
        SUM(CASE WHEN a.grade = 'C' THEN 1 ELSE 0 END) as gradeC,
        SUM(CASE WHEN a.grade = 'D' THEN 1 ELSE 0 END) as gradeD,
        SUM(CASE WHEN a.is_anomaly = 1 THEN 1 ELSE 0 END) as anomalyCount
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id
      LEFT JOIN artworks a ON a.student_id = s.id
      WHERE c.grade_id = ?
      GROUP BY c.id
      ORDER BY c.name
    `, [req.params.id])
    res.json(rows)
  } catch (err) {
    console.error('Error fetching grade breakdown:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取教师可选班级列表
router.get('/classes', authMiddleware, async (req, res) => {
  try {
    let classes
    if (req.user.role === 'admin') {
      classes = await dbAll(`
        SELECT c.id, c.name as class_name, g.name as grade_name
        FROM classes c
        JOIN grades g ON c.grade_id = g.id
        ORDER BY g.name, c.name
      `)
    } else {
      classes = await dbAll(`
        SELECT c.id, c.name as class_name, g.name as grade_name
        FROM classes c
        JOIN grades g ON c.grade_id = g.id
        JOIN teacher_classes tc ON tc.class_id = c.id
        WHERE tc.teacher_id = ?
        ORDER BY g.name, c.name
      `, [req.user.id])
    }
    res.json(classes)
  } catch (err) {
    console.error('Error fetching classes:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

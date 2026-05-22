import { Router } from 'express'
import { z } from 'zod'
import { URL } from 'url'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { requireOwnership } from '../middleware/requireOwnership.js'

const createArtworkSchema = z.object({
  studentId: z.number().int().positive(),
  taskId: z.number().int().positive().nullable().optional(),
  title: z.string().max(200).optional(),
  imageUrl: z.string().min(1),
  theme: z.string().max(200).optional()
})

const reviewSchema = z.object({
  comment: z.string().min(1).max(5000),
  override: z.boolean().optional()
})

const router = Router()

// Rewrite image paths to /api/upload/ for protected access.
// 已经以 / 或 http(s):// 开头的视为绝对/外部路径，不再二次前缀。
const rewriteUploadUrl = (artwork) => {
  const url = artwork.image_url
  if (!url) return { ...artwork, image_url: null }
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
    return { ...artwork, image_url: url }
  }
  return { ...artwork, image_url: `/api/upload/${url}` }
}

// 获取任务下作品列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { taskId, is_anomaly } = req.query
    if (!taskId) return res.status(400).json({ error: 'taskId required' })

    const task = await dbGet('SELECT * FROM analysis_tasks WHERE id = ?', [taskId])
    if (!task) return res.status(404).json({ error: 'Task not found' })

    let sql = `
      SELECT a.*, s.name as student_name, s.student_no
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      WHERE a.task_id = ?
    `
    const params = [taskId]

    if (is_anomaly !== undefined) {
      sql += ' AND a.is_anomaly = ?'
      params.push(Number(is_anomaly))
    }

    sql += ' ORDER BY a.total_score DESC'

    const artworks = await dbAll(sql, params)
    res.json(artworks.map(a => rewriteUploadUrl({
      ...a,
      scores: a.scores ? JSON.parse(a.scores) : null
    })))
  } catch (err) {
    console.error('Error fetching artworks:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 创建作品记录（仅教师/管理员）
router.post('/', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const parsed = createArtworkSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

    const { studentId, taskId, title, imageUrl, theme } = parsed.data

    // Validate imageUrl to prevent SSRF
    if (!isValidImageUrl(imageUrl)) {
      return res.status(400).json({ error: 'Invalid image URL' })
    }

    const result = await dbRun(
      `INSERT INTO artworks (student_id, task_id, title, image_url, theme) VALUES (?, ?, ?, ?, ?)`,
      [studentId, taskId || null, title || '', imageUrl, theme || '']
    )
    res.json({ id: result.lastID })
  } catch (err) {
    console.error('Error creating artwork:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取所有教师释义记录（必须在 /:id 之前定义）
router.get('/reviews', authMiddleware, async (req, res) => {
  try {
    const { teacherId, artworkId } = req.query

    let sql = `
      SELECT r.*, u.name as teacher_name,
        a.title as artwork_title, a.image_url, a.grade as artwork_grade,
        s.name as student_name, c.name as class_name,
        t.theme as task_theme
      FROM teacher_reviews r
      JOIN users u ON r.teacher_id = u.id
      JOIN artworks a ON r.artwork_id = a.id
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN analysis_tasks t ON a.task_id = t.id
      WHERE 1=1
    `
    const params = []

    if (teacherId) {
      sql += ' AND r.teacher_id = ?'
      params.push(teacherId)
    }

    if (artworkId) {
      sql += ' AND r.artwork_id = ?'
      params.push(artworkId)
    }

    sql += ' ORDER BY r.created_at DESC'

    const reviews = await dbAll(sql, params)
    res.json(reviews.map(r => rewriteUploadUrl(r)))
  } catch (err) {
    console.error('Error fetching reviews:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取所有异常作品（单次查询）
router.get('/anomalies', authMiddleware, async (req, res) => {
  try {
    const artworks = await dbAll(`
      SELECT a.*, s.name as student_name, s.student_no, c.name as class_name, t.theme as task_name
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN analysis_tasks t ON a.task_id = t.id
      WHERE a.is_anomaly = 1 OR EXISTS (
        SELECT 1 FROM teacher_reviews tr WHERE tr.artwork_id = a.id AND tr.override = 1
      )
      ORDER BY a.upload_time DESC
    `, [])

    const artworkIds = artworks.map(a => a.id)
    if (artworkIds.length === 0) return res.json([])

    const reviews = await dbAll(`
      SELECT tr.artwork_id, tr.comment, u.name as teacher_name, tr.created_at
      FROM teacher_reviews tr
      JOIN users u ON tr.teacher_id = u.id
      WHERE tr.artwork_id IN (${artworkIds.map(() => '?').join(',')})
      ORDER BY tr.created_at DESC
    `, artworkIds)

    const reviewMap = {}
    reviews.forEach(r => {
      if (!reviewMap[r.artwork_id]) reviewMap[r.artwork_id] = r
    })

    res.json(artworks.map(a => rewriteUploadUrl({
      ...a,
      scores: a.scores ? JSON.parse(a.scores) : null,
      review: reviewMap[a.id] || null
    })))
  } catch (err) {
    console.error('Error fetching anomalies:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取作品上下文（详情 + 班级均值 + 学生历史）
router.get('/:id/context', authMiddleware, async (req, res) => {
  try {
    const artwork = await dbGet(`
      SELECT a.*, s.name as student_name, s.student_no, s.id as sid, c.name as class_name, c.id as class_id
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      WHERE a.id = ?
    `, [req.params.id])

    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })

    const parsedArtwork = { ...artwork, scores: artwork.scores ? JSON.parse(artwork.scores) : null }

    const [review, classAvg, history] = await Promise.all([
      dbGet(`
        SELECT r.*, u.name as teacher_name
        FROM teacher_reviews r
        JOIN users u ON r.teacher_id = u.id
        WHERE r.artwork_id = ?
        ORDER BY r.created_at DESC LIMIT 1
      `, [req.params.id]),
      dbGet(`
        SELECT
          AVG(CASE WHEN json_valid(scores) THEN json_extract(scores, '$.color') END) as avg_color,
          AVG(CASE WHEN json_valid(scores) THEN json_extract(scores, '$.composition') END) as avg_composition,
          AVG(CASE WHEN json_valid(scores) THEN json_extract(scores, '$.theme') END) as avg_theme,
          AVG(CASE WHEN json_valid(scores) THEN json_extract(scores, '$.expression') END) as avg_expression,
          AVG(total_score) as avg_total
        FROM artworks a2
        JOIN students s2 ON a2.student_id = s2.id
        WHERE s2.class_id = ? AND a2.task_id = ?
      `, [artwork.class_id, artwork.task_id]),
      dbAll(`
        SELECT a3.id, a3.title, a3.theme, a3.total_score, a3.grade, a3.upload_time, a3.image_url
        FROM artworks a3
        WHERE a3.student_id = ?
        ORDER BY a3.upload_time ASC
      `, [artwork.sid])
    ])

    res.json({
      artwork: rewriteUploadUrl({ ...parsedArtwork, review }),
      classAvg: classAvg ? {
        color: Math.round(classAvg.avg_color || 0),
        composition: Math.round(classAvg.avg_composition || 0),
        theme: Math.round(classAvg.avg_theme || 0),
        expression: Math.round(classAvg.avg_expression || 0),
        total: Math.round(classAvg.avg_total || 0)
      } : null,
      studentHistory: history.map(h => rewriteUploadUrl(h))
    })
  } catch (err) {
    console.error('Error fetching artwork context:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取作品详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const artwork = await dbGet(`
      SELECT a.*, s.name as student_name, s.student_no, c.name as class_name
      FROM artworks a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      WHERE a.id = ?
    `, [req.params.id])

    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })

    const review = await dbGet(`
      SELECT r.*, u.name as teacher_name
      FROM teacher_reviews r
      JOIN users u ON r.teacher_id = u.id
      WHERE r.artwork_id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `, [req.params.id])

    res.json(rewriteUploadUrl({
      ...artwork,
      scores: artwork.scores ? JSON.parse(artwork.scores) : null,
      review
    }))
  } catch (err) {
    console.error('Error fetching artwork detail:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 教师释义（仅教师/管理员）
router.post('/:id/review', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const parsed = reviewSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

    const { comment, override } = parsed.data

    const artwork = await dbGet('SELECT id FROM artworks WHERE id = ?', [req.params.id])
    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })

    // Wrap in transaction: review insert + optional anomaly override
    await dbRun('BEGIN')
    try {
      await dbRun(
        `INSERT INTO teacher_reviews (artwork_id, teacher_id, comment, override) VALUES (?, ?, ?, ?)`,
        [req.params.id, req.user.id, comment, override ? 1 : 0]
      )

      if (override) {
        await dbRun('UPDATE artworks SET is_anomaly = 0 WHERE id = ?', [req.params.id])
      }
      await dbRun('COMMIT')
      res.json({ ok: true })
    } catch (txErr) {
      await dbRun('ROLLBACK')
      throw txErr
    }
  } catch (err) {
    console.error('Error adding review:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 单幅作品 AI 分析（仅教师/管理员）
router.post('/:id/analyze', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const artwork = await dbGet('SELECT * FROM artworks WHERE id = ?', [req.params.id])
    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })

    const { analyzeArtwork } = await import('../services/miniMax.js')
    const theme = artwork.theme || '未知主题'
    const result = await analyzeArtwork(artwork.image_url, theme)

    await dbRun(
      `UPDATE artworks SET scores = ?, grade = ?, total_score = ?, is_anomaly = ?, anomaly_reason = ? WHERE id = ?`,
      [JSON.stringify(result.scores), result.grade, result.totalScore, result.isAnomaly ? 1 : 0, result.reason, artwork.id]
    )

    res.json({
      ...result,
      artworkId: artwork.id
    })
  } catch (err) {
    console.error('Error analyzing artwork:', err)
    res.status(500).json({ error: '分析失败: ' + err.message })
  }
})

// SSRF-safe URL validation: allow only /uploads/ paths or PUBLIC hostnames
function isValidImageUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false

  // Internal paths are always safe
  if (urlStr.startsWith('/uploads/') || urlStr.startsWith('/api/upload/')) return true

  // For remote URLs, parse and validate
  try {
    const parsed = new URL(urlStr)
    // Block private/link-local IPs and special hostnames
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254.169.254', 'metadata.google.internal']
    if (blocked.includes(parsed.hostname)) return false
    // Block RFC 1918 private ranges via simple prefix check
    if (parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.') ||
        parsed.hostname.startsWith('172.') && parseInt(parsed.hostname.split('.')[1]) >= 16 && parseInt(parsed.hostname.split('.')[1]) <= 31) {
      return false
    }
    // Only allow HTTPS for external URLs
    if (parsed.protocol !== 'https:') return false
    return true
  } catch {
    return false
  }
}

export default router

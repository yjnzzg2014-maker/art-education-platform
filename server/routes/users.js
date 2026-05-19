import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()

// 教师/用户列表
router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.query
    let sql = `SELECT u.id, u.username, u.name, u.role, u.school_id, u.created_at,
      s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id`
    const params = []
    if (role) { sql += ' WHERE u.role = ?'; params.push(role) }
    sql += ' ORDER BY u.role, u.name'
    const rows = await dbAll(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('Error fetching users:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 获取单个用户
router.get('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const user = await dbGet(`
      SELECT u.id, u.username, u.name, u.role, u.school_id, u.created_at,
        s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.id = ?`, [req.params.id])
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    console.error('Error fetching user:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 新增教师/用户 (仅 admin)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, name, role = 'teacher', school_id } = req.body

    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: 'username 至少2个字符' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'password 至少6个字符' })
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name 不能为空' })
    }
    if (!['teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role 只能是 teacher 或 admin' })
    }

    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username.trim()])
    if (existing) return res.status(409).json({ error: '用户名已存在' })

    const hash = await bcrypt.hash(password, 10)
    const schoolId = school_id || 1
    const result = await dbRun(
      'INSERT INTO users (username, password_hash, name, role, school_id) VALUES (?, ?, ?, ?, ?)',
      [username.trim(), hash, name.trim(), role, schoolId]
    )
    const created = await dbGet(`
      SELECT u.id, u.username, u.name, u.role, u.school_id, u.created_at,
        s.name as school_name
      FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.id = ?`, [result.lastID])
    res.status(201).json(created)
  } catch (err) {
    console.error('Error creating user:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 更新用户
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const existing = await dbGet('SELECT id FROM users WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ error: 'User not found' })

    const { name, role, school_id, password } = req.body
    const updates = []
    const params = []

    if (name && typeof name === 'string' && name.trim()) {
      updates.push('name = ?')
      params.push(name.trim())
    }
    if (role && ['teacher', 'admin'].includes(role)) {
      updates.push('role = ?')
      params.push(role)
    }
    if (school_id !== undefined) {
      updates.push('school_id = ?')
      params.push(school_id || null)
    }
    if (password && password.length >= 6) {
      updates.push('password_hash = ?')
      params.push(await bcrypt.hash(password, 10))
    }

    if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' })

    params.push(req.params.id)
    await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)
    const updated = await dbGet(`
      SELECT u.id, u.username, u.name, u.role, u.school_id, u.created_at,
        s.name as school_name
      FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.id = ?`, [req.params.id])
    res.json(updated)
  } catch (err) {
    console.error('Error updating user:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// 删除用户
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const user = await dbGet('SELECT id, role FROM users WHERE id = ?', [req.params.id])
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.role === 'admin') return res.status(403).json({ error: '不能删除管理员账号' })

    await dbRun('DELETE FROM users WHERE id = ?', [req.params.id])
    res.status(204).end()
  } catch (err) {
    console.error('Error deleting user:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

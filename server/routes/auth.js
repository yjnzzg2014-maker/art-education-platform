import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
})

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '用户名或密码不能为空' })
    }

    const user = await dbGet('SELECT id, username, password_hash, role, name FROM users WHERE username = ?', [username])
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, name: user.name, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    )

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, role: user.role, name: user.name }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' })

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Invalid refresh token' })

    const user = await dbGet('SELECT id, username, role, name FROM users WHERE id = ?', [decoded.id])
    if (!user) return res.status(401).json({ error: 'User not found' })

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, name: user.name, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    )

    res.json({ token: accessToken, user: { id: user.id, username: user.username, role: user.role, name: user.name } })
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Refresh token expired' })
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    // Blacklist token by jti
    const decoded = jwt.decode(req.token)
    if (decoded.jti) {
      await dbRun(
        'INSERT INTO token_blacklist (token_hash, user_id, expires_at) VALUES (?, ?, datetime("now", "+7 days"))',
        [decoded.jti, req.user.id]
      )
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Logout error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

router.get('/teachers', authMiddleware, async (req, res) => {
  try {
    const teachers = await dbAll(
      'SELECT id, name, role, school_id FROM users WHERE role IN ("teacher","admin") ORDER BY name'
    )
    res.json(teachers)
  } catch (err) {
    console.error('Error fetching teachers:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, role, name FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'User not found' })

    const school = await dbGet('SELECT name FROM schools WHERE id = (SELECT school_id FROM users WHERE id = ?)', [req.user.id])
    res.json({ ...user, schoolName: school?.name || null })
  } catch (err) {
    console.error('Error fetching user:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

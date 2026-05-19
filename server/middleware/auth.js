import jwt from 'jsonwebtoken'
import { dbGet } from '../db.js'

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = auth.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    req.token = token
    checkBlacklist(req, res, next)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    return res.status(401).json({ error: 'Invalid token' })
  }
}

async function checkBlacklist(req, res, next) {
  try {
    const decoded = jwt.decode(req.token)
    if (decoded.jti) {
      const blacklisted = await dbGet(
        'SELECT 1 FROM token_blacklist WHERE token_hash = ? AND expires_at > datetime("now")',
        [decoded.jti]
      )
      if (blacklisted) {
        return res.status(401).json({ error: 'Token revoked' })
      }
    }
    // Fetch current role from DB (not trusting JWT) and attach to request
    const user = await dbGet('SELECT role FROM users WHERE id = ?', [req.user.id])
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user.role = user.role
    next()
  } catch (err) {
    console.error('Auth check error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}

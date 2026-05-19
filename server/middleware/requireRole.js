export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No token provided' })
  if (req.user.role !== role && req.user.role !== 'admin') {
    return res.status(403).json({ error: `Requires ${role} role` })
  }
  next()
}

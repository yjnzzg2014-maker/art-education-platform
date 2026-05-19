import { dbGet } from '../db.js'

const ALLOWED_TABLES = new Set(['analysis_tasks', 'artworks', 'teacher_reviews'])
const ALLOWED_COLUMNS = new Set(['id', 'task_id', 'artwork_id'])

export function requireOwnership(table, { idParam = 'id', idColumn = 'id' } = {}) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`requireOwnership: table "${table}" not in whitelist`)
  if (!ALLOWED_COLUMNS.has(idColumn)) throw new Error(`requireOwnership: column "${idColumn}" not in whitelist`)

  return async (req, res, next) => {
    if (req.user.role === 'admin') return next()

    const resourceId = req.params[idParam] || req.body.taskId || req.query.taskId
    if (!resourceId) {
      // No specific resource to check — downstream handler must enforce filter
      return next()
    }

    try {
      const record = await dbGet(
        `SELECT teacher_id FROM ${table} WHERE ${idColumn} = ?`,
        [resourceId]
      )
      if (!record) {
        return res.status(404).json({ error: 'Resource not found' })
      }
      if (record.teacher_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: not your resource' })
      }
      next()
    } catch (err) {
      console.error('Ownership check error:', err)
      res.status(500).json({ error: 'Internal error' })
    }
  }
}

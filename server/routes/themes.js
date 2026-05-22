import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取所有模板
router.get('/', authMiddleware, async (req, res) => {
  try {
    const themes = await dbAll(
      'SELECT id, name, type, description, is_active FROM themes WHERE is_active = 1 ORDER BY id'
    )
    res.json(themes)
  } catch (err) {
    console.error('Failed to fetch themes:', err)
    res.status(500).json({ error: '获取课题模板失败' })
  }
})

// 获取单个模板
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const theme = await dbGet(
      'SELECT id, name, type, description, is_active FROM themes WHERE id = ?',
      [req.params.id]
    )
    if (!theme) {
      return res.status(404).json({ error: '模板不存在' })
    }
    res.json(theme)
  } catch (err) {
    console.error('Failed to fetch theme:', err)
    res.status(500).json({ error: '获取课题模板失败' })
  }
})

// 创建模板（仅管理员）
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可创建模板' })
    }
    const { name, type, description } = req.body
    if (!name || !type) {
      return res.status(400).json({ error: '名称和类型不能为空' })
    }
    const result = await dbRun(
      'INSERT INTO themes (name, type, description) VALUES (?, ?, ?)',
      [name, type, description || '']
    )
    res.json({ id: result.lastID, name, type, description })
  } catch (err) {
    console.error('Failed to create theme:', err)
    res.status(500).json({ error: '创建课题模板失败' })
  }
})

// 更新模板（仅管理员）
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可更新模板' })
    }
    const { name, type, description, is_active } = req.body
    await dbRun(
      'UPDATE themes SET name = ?, type = ?, description = ?, is_active = ? WHERE id = ?',
      [name, type, description || '', is_active ?? 1, req.params.id]
    )
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to update theme:', err)
    res.status(500).json({ error: '更新课题模板失败' })
  }
})

// 删除模板（仅管理员）- 软删除
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可删除模板' })
    }
    await dbRun('UPDATE themes SET is_active = 0 WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    console.error('Failed to delete theme:', err)
    res.status(500).json({ error: '删除课题模板失败' })
  }
})

export default router

import { Router } from 'express'
import { z } from 'zod'
import { dbGet, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { encrypt, decrypt } from '../utils/crypto.js'

const router = Router()

const ALLOWED_KEYS = ['minimax_api_key']

function maskKey(val) {
  if (!val || val.length < 8) return val ? '****' : ''
  return val.slice(0, 4) + '****' + val.slice(-4)
}

router.get('/', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const result = {}
    for (const key of ALLOWED_KEYS) {
      const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key])
      const rawValue = row?.value ? decrypt(row.value) : ''
      const hasValue = rawValue.length > 0
      result[key] = { configured: hasValue, masked: hasValue ? maskKey(rawValue) : '' }
    }
    result.env_minimax = !!process.env.MINIMAX_API_KEY
    res.json(result)
  } catch (err) {
    console.error('Error fetching settings:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

const updateSchema = z.object({
  key: z.string(),
  value: z.string().max(500)
})

router.put('/', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

    const { key, value } = parsed.data
    if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Invalid setting key' })

    if (!value) {
      await dbRun('DELETE FROM settings WHERE key = ?', [key])
    } else {
      const encrypted = encrypt(value)
      await dbRun(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, encrypted]
      )
    }
    res.json({ ok: true, masked: maskKey(value) })
  } catch (err) {
    console.error('Error updating setting:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

router.post('/test-api', authMiddleware, requireRole('teacher'), async (req, res) => {
  try {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', ['minimax_api_key'])
    const apiKey = (row?.value ? decrypt(row.value) : '') || process.env.MINIMAX_API_KEY || ''

    if (!apiKey) return res.json({ ok: false, error: '未配置 API Key' })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const response = await fetch('https://api.minimaxi.com/v1/coding_plan/vlm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: '请用一句话描述这张图片',
        image_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
      }),
      signal: controller.signal
    })

    clearTimeout(timer)

    if (response.status === 401 || response.status === 403) {
      return res.json({ ok: false, error: 'API Key 无效或已过期' })
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return res.json({ ok: false, error: `API 返回 ${response.status}: ${body.slice(0, 100)}` })
    }

    const data = await response.json()
    if (data.base_resp?.status_code !== 0) {
      return res.json({ ok: false, error: `API 错误: ${data.base_resp?.status_msg}` })
    }
    res.json({ ok: true, message: `VLM 视觉接口连接成功` })
  } catch (err) {
    const msg = err.name === 'AbortError' ? '连接超时' : err.message
    res.json({ ok: false, error: msg })
  }
})

export default router

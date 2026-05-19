import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.js'
import tasksRoutes from './routes/tasks.js'
import artworksRoutes from './routes/artworks.js'
import studentsRoutes from './routes/students.js'
import gradesRoutes from './routes/grades.js'
import classesRoutes from './routes/classes.js'
import statsRoutes from './routes/stats.js'
import uploadRoutes from './routes/upload.js'
import settingsRoutes from './routes/settings.js'
import usersRoutes from './routes/users.js'

import db, { initPromise, dbGet } from './db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8085

// Trust reverse proxy for HTTPS behind nginx
app.set('trust proxy', 1)

app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || true,
  credentials: true
}))
app.use(morgan('combined'))
app.use(express.json({ limit: '1mb' }))

// 静态文件（仅前端构建产物，不上传目录，含缓存头）
app.use(express.static(path.join(__dirname, '../public'), {
  dotfiles: 'deny',
  index: false,
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    }
  }
}))

// API 路由
app.use('/api/auth', authRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/artworks', artworksRoutes)
app.use('/api/students', studentsRoutes)
app.use('/api/grades', gradesRoutes)
app.use('/api/classes', classesRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/users', usersRoutes)

// 健康检查（验证数据库连通性）
app.get('/api/health', async (req, res) => {
  try {
    const row = await dbGet('SELECT 1 as ok')
    res.json({ status: row ? 'ok' : 'degraded', time: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'degraded', time: new Date().toISOString() })
  }
})

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set')
  process.exit(1)
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 32')
  process.exit(1)
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_REFRESH_SECRET environment variable is not set')
  process.exit(1)
}
if (process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters')
  process.exit(1)
}

// Wait for database initialization before listening
initPromise.then(() => {
  const server = app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
    console.log(`Art Education API Server running on http://${process.env.HOST || '127.0.0.1'}:${PORT}`)
  })

  // Graceful shutdown
  function shutdown(signal) {
    console.log(`\n${signal} received, shutting down gracefully...`)
    server.close(() => {
      console.log('HTTP server closed')
      db.close((err) => {
        if (err) console.error('DB close error:', err)
        else console.log('Database connection closed')
        process.exit(0)
      })
    })
    // Force exit after 10s
    setTimeout(() => { console.error('Forced shutdown'); process.exit(1) }, 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}).catch(err => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})

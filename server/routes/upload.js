import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { fileTypeFromFile } from 'file-type'
import { dbGet, dbAll, dbRun } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + ext
    cb(null, name)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  }
})

const router = Router()

// Batch upload artworks for a task
router.post('/artworks', authMiddleware, upload.array('images', 20), async (req, res) => {
  try {
    const { taskId } = req.body
    if (!taskId) return res.status(400).json({ error: 'taskId required' })
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' })
    }

    const task = await dbGet('SELECT * FROM analysis_tasks WHERE id = ?', [taskId])
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const students = await dbAll('SELECT id, name, student_no FROM students WHERE class_id = ?', [task.class_id])

    const studentMap = {}
    students.forEach(s => {
      studentMap[s.student_no] = s
      studentMap[s.name] = s
    })

    const results = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      // Validate magic bytes after multer writes to disk
      try {
        const type = await fileTypeFromFile(file.path)
        const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
        if (!type || !allowedMimes.includes(type.mime)) {
          fs.unlinkSync(file.path)
          results.push({ file: file.originalname, error: 'Invalid file type detected' })
          continue
        }
      } catch (e) {
        results.push({ file: file.originalname, error: 'File validation failed' })
        continue
      }

      const imageUrl = `/api/upload/${file.filename}`
      const originalName = path.basename(file.originalname, path.extname(file.originalname))

      let studentId = req.body[`studentId_${i}`] || null
      if (!studentId) {
        for (const key of Object.keys(studentMap)) {
          if (originalName.includes(key)) {
            studentId = studentMap[key].id
            break
          }
        }
      }
      if (!studentId && students[i]) {
        studentId = students[i].id
      }

      if (!studentId) {
        results.push({ file: file.originalname, error: 'No matching student found' })
        continue
      }

      const title = originalName || `《${task.theme}》`
      const result = await dbRun(
        `INSERT INTO artworks (student_id, task_id, title, image_url, theme) VALUES (?, ?, ?, ?, ?)`,
        [studentId, taskId, title, imageUrl, task.theme]
      )
      results.push({ id: result.lastID, file: file.originalname, imageUrl, studentId })
    }

    await dbRun('UPDATE analysis_tasks SET status = ? WHERE id = ?', ['pending', taskId])
    res.json({ uploaded: results.filter(r => r.id).length, errors: results.filter(r => r.error).length, results })
  } catch (err) {
    console.error('Error in batch upload:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// Serve uploaded files (protected, requires auth)
router.get('/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename)

  // Security check: prevent path traversal
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return res.status(403).send('Forbidden')
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Upload file error:', err)
      res.status(404).json({ error: 'File not found' })
    }
  })
})

// Single image upload (for diagnosis page etc.)
router.post('/image', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file' })
  const imageUrl = `/api/upload/${req.file.filename}`
  res.json({ imageUrl, filename: req.file.filename, originalName: req.file.originalname })
})

export default router

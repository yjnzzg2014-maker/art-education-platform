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
const PUBLIC_IMAGES_DIR = path.join(__dirname, '..', '..', 'public', 'images')

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true })

// Upload to temp location first, then move
const tempStorage = multer.diskStorage({
  destination: () => UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`
    cb(null, name)
  }
})

const upload = multer({
  storage: tempStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  }
})

const router = Router()

// Serve uploaded files (public, no auth required for GET)
// Handles nested paths like: 一年级1班/我眼中的春天/pic-spring1.png
router.get('/*', (req, res) => {
  const filename = req.params[0]  // Express captures the wildcard path
  const filePath = path.join(UPLOAD_DIR, filename)

  // Security: prevent path traversal
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return res.status(403).send('Forbidden')
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Send file error:', err)
      res.status(404).json({ error: 'File not found' })
    }
  })
})

// Batch upload artworks for a task
router.post('/artworks', authMiddleware, upload.array('images', 20), async (req, res) => {
  try {
    const { taskId } = req.body
    if (!taskId) return res.status(400).json({ error: 'taskId required' })
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' })
    }

    // Get task with class/grade info
    const task = await dbGet(`
      SELECT t.*, g.name as grade_name, c.name as class_name
      FROM analysis_tasks t
      JOIN classes c ON t.class_id = c.id
      JOIN grades g ON c.grade_id = g.id
      WHERE t.id = ?
    `, [taskId])
    if (!task) return res.status(404).json({ error: 'Task not found' })

    // Build target subdirectory: {grade_name}{class_name}/{theme}/
    const targetSubDir = `${task.grade_name}${task.class_name}/${task.theme}/`
    const targetDir = path.join(UPLOAD_DIR, targetSubDir)
    fs.mkdirSync(targetDir, { recursive: true })

    // Get students for matching
    const students = await dbAll('SELECT id, name, student_no FROM students WHERE class_id = ?', [task.class_id])
    const studentMap = {}
    students.forEach(s => {
      studentMap[s.student_no] = s
      studentMap[s.name] = s
    })

    const results = []

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i]
      const originalName = path.basename(file.originalname, path.extname(file.originalname))

      // Validate magic bytes
      try {
        const type = await fileTypeFromFile(file.path)
        const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
        if (!type || !allowedMimes.includes(type.mime)) {
          fs.unlinkSync(file.path)
          results.push({ file: file.originalname, error: 'Invalid file type' })
          continue
        }
      } catch (e) {
        results.push({ file: file.originalname, error: 'File validation failed' })
        continue
      }

      // Move to target directory with clean filename
      const ext = path.extname(file.originalname).toLowerCase()
      const baseName = originalName.replace(/[^a-zA-Z0-9一-龥]/g, '_').substring(0, 30)
      const newFilename = `${baseName}_${Date.now()}.${ext.replace('.', '')}`
      const newPath = path.join(targetDir, newFilename)
      const relativePath = `${targetSubDir}${newFilename}`

      try {
        fs.renameSync(file.path, newPath)
      } catch (e) {
        // Cross-device fallback
        fs.copyFileSync(file.path, newPath)
        fs.unlinkSync(file.path)
      }

      // Match student by filename
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
        [studentId, taskId, title, relativePath, task.theme]
      )
      results.push({ id: result.lastID, file: file.originalname, imageUrl: relativePath, studentId })
    }

    await dbRun('UPDATE analysis_tasks SET status = ? WHERE id = ?', ['pending', taskId])
    res.json({
      uploaded: results.filter(r => r.id).length,
      errors: results.filter(r => r.error).length,
      results
    })
  } catch (err) {
    console.error('Error in batch upload:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// Single image upload (stores in /misc/ subdirectory)
router.post('/image', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file' })

  try {
    const type = await fileTypeFromFile(req.file.path)
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
    if (!type || !allowedMimes.includes(type.mime)) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Invalid file type' })
    }

    const targetDir = path.join(UPLOAD_DIR, 'misc')
    fs.mkdirSync(targetDir, { recursive: true })

    const ext = path.extname(req.file.originalname).toLowerCase()
    const baseName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9一-龥]/g, '_').substring(0, 30)
    const newFilename = `${baseName}_${Date.now()}.${ext.replace('.', '')}`
    const newPath = path.join(targetDir, newFilename)
    const relativePath = `misc/${newFilename}`

    try {
      fs.renameSync(req.file.path, newPath)
    } catch (e) {
      fs.copyFileSync(req.file.path, newPath)
      fs.unlinkSync(req.file.path)
    }

    res.json({ imageUrl: relativePath, filename: newFilename, originalName: req.file.originalname })
  } catch (e) {
    console.error('Upload error:', e)
    res.status(500).json({ error: 'Upload failed' })
  }
})

export default router

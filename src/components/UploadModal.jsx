import { useState, useRef, useEffect } from 'react'
import client from '../api/client'

export default function UploadModal({ taskId, students, onClose, onUploaded }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ uploaded: 0, total: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [autoAssign, setAutoAssign] = useState(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleFiles = (newFiles) => {
    const validFiles = Array.from(newFiles).filter(f =>
      ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'].some(ext =>
        f.name.toLowerCase().endsWith(ext)
      )
    )
    setFiles(prev => [...prev, ...validFiles])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleRemove = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const tryAutoMatch = (filename) => {
    if (!students) return null
    const name = filename.replace(/\.[^.]+$/, '')
    for (const s of students) {
      if (name.includes(s.name) || name.includes(s.student_no)) {
        return s.id
      }
    }
    return null
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    setProgress({ uploaded: 0, total: files.length })

    const formData = new FormData()
    formData.append('taskId', taskId)
    files.forEach((file, i) => {
      formData.append('images', file)
      if (autoAssign) {
        const matchId = tryAutoMatch(file.name)
        if (matchId) formData.append(`studentId_${i}`, matchId)
      }
    })

    try {
      const { data } = await client.post('/upload/artworks', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress({ uploaded: Math.round((e.loaded / e.total) * files.length), total: files.length })
          }
        }
      })
      setProgress({ uploaded: data.uploaded, total: files.length })
      onUploaded && onUploaded(data)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="上传作品图片" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="bg-white rounded-lg w-[640px] max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-lg">导入作品图片</h3>
            <p className="text-sm text-gray-500 mt-1">
              支持 PNG / JPG / WebP / HEIC，单文件不超过 20MB
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm text-gray-600">拖拽图片到此处，或点击选择文件</p>
            <p className="text-xs text-gray-400 mt-1">可一次选择多张图片</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.heic,.heif"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {/* Auto-assign toggle */}
          {students && students.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoAssign}
                onChange={e => setAutoAssign(e.target.checked)}
                className="rounded"
              />
              根据文件名自动匹配学生（文件名包含姓名或学号时生效）
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-2">
                已选择 {files.length} 个文件（{formatSize(files.reduce((s, f) => s + f.size, 0))}）
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {files.map((file, i) => {
                  const matchId = autoAssign && tryAutoMatch(file.name)
                  const matchedStudent = matchId && students ? students.find(s => s.id === matchId) : null
                  return (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 bg-gray-50 rounded">
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-gray-400 mx-2">{formatSize(file.size)}</span>
                      {matchedStudent && (
                        <span className="text-green-600 text-xs mr-2">→ {matchedStudent.name}</span>
                      )}
                      <button onClick={() => handleRemove(i)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">
                上传中... {progress.uploaded}/{progress.total}
              </div>
              <div className="h-2 bg-gray-200 rounded">
                <div
                  className="h-2 bg-blue-500 rounded transition-all"
                  style={{ width: `${progress.total ? (progress.uploaded / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Student list reference */}
          {students && students.length > 0 && !autoAssign && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-1">班级学生（文件名将按顺序匹配）：</div>
              <div className="text-xs text-gray-400">
                {students.slice(0, 5).map(s => s.name).join('、')}
                {students.length > 5 && ` 等${students.length}人`}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">取消</button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? '上传中...' : `上传 ${files.length} 幅作品`}
          </button>
        </div>
      </div>
    </div>
  )
}

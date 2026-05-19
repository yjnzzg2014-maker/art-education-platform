import { useState } from 'react'

export default function ReviewModal({ artworkId, studentName, onSubmit, onClose, showOverride = true }) {
  const [comment, setComment] = useState('')
  const [override, setOverride] = useState(true)

  const handleSubmit = () => {
    if (!comment.trim()) return
    onSubmit({ comment: comment.trim(), override })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[480px] p-6">
        <h3 className="font-semibold text-lg mb-1">教师释义</h3>
        <p className="text-sm text-gray-500 mb-4">
          为{studentName ? ` ${studentName} 的` : ''}作品 #{artworkId} 提供释义评语
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="请输入您对该作品异常判定的专业释义..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={4}
          autoFocus
        />
        {showOverride && (
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={override}
              onChange={e => setOverride(e.target.checked)}
              className="rounded"
            />
            同时覆盖 AI 异常标记（将作品移出异常列表）
          </label>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50">取消</button>
          <button onClick={handleSubmit} disabled={!comment.trim()} className="flex-1 bg-green-600 text-white rounded py-2 text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
            提交释义
          </button>
        </div>
      </div>
    </div>
  )
}

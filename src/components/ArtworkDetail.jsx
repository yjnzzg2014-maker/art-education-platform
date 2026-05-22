import MaskName from './MaskName'

function generateClientCommentary(scores) {
  if (!scores) return null
  const parts = []
  const { color, composition, theme, expression } = scores
  if (color >= 80) parts.push('色彩运用丰富且协调')
  else if (color >= 60) parts.push('色彩运用基本得当')
  else parts.push('色彩运用较为单一')
  if (composition >= 80) parts.push('构图完整有层次')
  else if (composition >= 60) parts.push('构图基本完整')
  else parts.push('构图尚需改善')
  if (theme >= 80) parts.push('主题表达清晰')
  else if (theme >= 60) parts.push('主题有所体现')
  else parts.push('主题契合度偏低')
  if (expression >= 80) parts.push('造型表现力突出')
  else if (expression >= 60) parts.push('造型表现中规中矩')
  else parts.push('造型表现力不足')
  return parts.join('；') + '。'
}

export default function ArtworkDetail({ artwork, onClose, onReview }) {
  if (!artwork) return null

  const commentary = artwork.scores?.commentary || generateClientCommentary(artwork.scores)

  const scoreBars = [
    { key: 'color', label: '色彩运用' },
    { key: 'composition', label: '构图完整度' },
    { key: 'theme', label: '主题契合度' },
    { key: 'expression', label: '造型表现力' }
  ]

  const getScoreColor = (score) => {
    if (score >= 70) return 'bg-green-500'
    if (score >= 50) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-3 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
        <span className="font-semibold text-amber-800">作品详情 · <MaskName name={artwork.student_name} /></span>
        {artwork.is_anomaly && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded">值得关注 · 待释义</span>}
      </div>

      <div className="p-4">
        {artwork.image_url ? (
          <img src={artwork.image_url} alt={artwork.student_name} className="h-48 w-full object-contain bg-gray-100 rounded mb-4" />
        ) : (
          <div className="h-48 bg-gradient-to-br from-gray-300 to-gray-500 rounded mb-4"></div>
        )}

        <div className="text-xs text-gray-500 space-y-1 mb-4">
          <div className="flex justify-between"><span>作品ID</span><span>#{artwork.id}</span></div>
          <div className="flex justify-between"><span>采集时间</span><span>{new Date(artwork.upload_time).toLocaleString('zh-CN')}</span></div>
          <div className="flex justify-between"><span>分析模型</span><span>VisualEdu-v3.2</span></div>
        </div>

        <div className="border rounded overflow-hidden mb-4">
          <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 text-xs text-gray-500">
            <span>维度</span><span>分布</span><span>评分</span>
          </div>
          {scoreBars.map(({ key, label }) => {
            const score = artwork.scores?.[key] || 0
            return (
              <div key={key} className="grid grid-cols-3 gap-2 p-2 border-t text-xs items-center">
                <span>{label}</span>
                <div className="h-1 bg-gray-100 rounded"><div className={`h-1 ${getScoreColor(score)} rounded`} style={{ width: `${score}%` }}></div></div>
                <span className={score < 50 ? 'text-red-600 font-semibold' : 'text-gray-700'}>{score}</span>
              </div>
            )
          })}
        </div>

        {artwork.scores?.compositionType && (
          <div className="text-xs text-gray-500 mb-4">
            <span className="text-gray-400">构图类型：</span>
            <span className="font-medium text-gray-700">{artwork.scores.compositionType}</span>
          </div>
        )}

        {commentary && (
          <div className="bg-blue-50 border border-blue-100 rounded p-3 text-xs text-blue-800 mb-4">
            <strong className="block mb-1">AI 评语</strong>
            <p>{commentary}</p>
          </div>
        )}

        {artwork.is_anomaly && (
          <div className="bg-amber-50 border-l-3 border-amber-500 p-3 text-xs text-amber-800 mb-4">
            <strong>AI 判定依据：</strong>{artwork.anomaly_reason}
          </div>
        )}

        {artwork.review && (
          <div className="bg-green-50 border-l-3 border-green-500 p-3 text-xs text-green-800 mb-4">
            <div className="flex justify-between mb-1">
              <strong>教师释义记录</strong>
              <span className="text-gray-400">{artwork.review.teacher_name} · {new Date(artwork.review.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
            <p className="italic pl-2 border-l-2 border-green-500">{artwork.review.comment}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button className="flex-1 border py-2 rounded text-sm hover:bg-gray-50">查看历史</button>
          <button className="flex-1 border py-2 rounded text-sm hover:bg-gray-50">加入教研</button>
          {artwork.is_anomaly && (
            <button onClick={() => onReview(artwork.id)} className="flex-1 bg-green-500 text-white py-2 rounded text-sm hover:bg-green-600">教师释义</button>
          )}
        </div>
      </div>
    </div>
  )
}

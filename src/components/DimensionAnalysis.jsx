function generateDimCommentary(key, score) {
  const commentaryMap = {
    color: { high: '色彩运用丰富且协调，展现出较强的色彩感知力', mid: '色彩运用基本得当，建议尝试更多冷暖对比', low: '色彩运用较为单一，需加强色彩搭配训练' },
    composition: { high: '构图完整有层次，空间布局合理', mid: '构图基本完整，可进一步优化画面重心', low: '构图尚需改善，建议参考经典构图范式练习' },
    theme: { high: '主题表达清晰，内容紧扣主题要求', mid: '主题有所体现，但表达力度可加强', low: '主题契合度偏低，需引导学生深入理解主题' },
    expression: { high: '造型表现力突出，线条流畅自信', mid: '造型表现中规中矩，鼓励大胆尝试', low: '造型表现力不足，建议加强基础造型训练' }
  }
  const c = commentaryMap[key]
  if (!c) return ''
  if (score >= 80) return c.high
  if (score >= 60) return c.mid
  return c.low
}

export default function DimensionAnalysis({ scores, classAvg }) {
  if (!scores) return null

  const dims = [
    { key: 'color', label: '色彩运用', color: 'bg-red-400' },
    { key: 'composition', label: '构图完整度', color: 'bg-blue-400' },
    { key: 'theme', label: '主题契合度', color: 'bg-green-400' },
    { key: 'expression', label: '造型表现力', color: 'bg-purple-400' }
  ]

  return (
    <div className="space-y-4">
      {dims.map(d => {
        const score = scores[d.key] ?? 0
        const avg = classAvg?.[d.key] ?? 0
        const diff = score - avg
        return (
          <div key={d.key} className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-700">{d.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{score}</span>
                {classAvg && (
                  <span className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {diff >= 0 ? '+' : ''}{diff} vs 均值{avg}
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded relative">
              <div className={`h-2 ${d.color} rounded`} style={{ width: `${Math.min(score, 100)}%` }} />
              {classAvg && (
                <div className="absolute top-0 h-2 w-0.5 bg-gray-400" style={{ left: `${Math.min(avg, 100)}%` }} title={`班级均值: ${avg}`} />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{generateDimCommentary(d.key, score)}</p>
          </div>
        )
      })}
    </div>
  )
}

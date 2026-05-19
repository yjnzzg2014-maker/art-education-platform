export function buildColorDistribution(artworks) {
  if (!artworks.length) return []
  const keys = ['red','orange','yellow','green','cyan','blue','purple','pink','brown','gray','black']
  const names = { red:'红', orange:'橙', yellow:'黄', green:'绿', cyan:'青', blue:'蓝', purple:'紫', pink:'粉', brown:'棕', gray:'灰', black:'黑' }
  const totals = {}
  keys.forEach(k => totals[k] = 0)

  let count = 0
  artworks.forEach(a => {
    const dist = a.scores?.colorDist
    if (!dist) return
    keys.forEach(k => { totals[k] += (dist[k] || 0) })
    count++
  })

  if (count === 0) return []
  return keys.map(k => ({
    color: names[k],
    count: totals[k],
    pct: Math.round(totals[k] / count)
  }))
}

export function buildCompositionDistribution(artworks) {
  if (!artworks.length) return []
  const counts = { '居中式': 0, '满幅式': 0, '分割式': 0, '留白式': 0 }
  artworks.forEach(a => {
    const type = a.scores?.compositionType
    if (type && counts[type] !== undefined) counts[type]++
  })
  const total = artworks.length
  return Object.entries(counts).map(([type, count]) => ({
    type,
    count,
    pct: Math.round((count / total) * 100)
  }))
}

export function buildGradeDistribution(artworks) {
  const grades = { A: 0, B: 0, C: 0, D: 0 }
  artworks.forEach(a => {
    if (a.grade && grades[a.grade] !== undefined) grades[a.grade]++
  })
  return Object.entries(grades).map(([grade, count]) => ({
    grade,
    count,
    pct: artworks.length ? Math.round((count / artworks.length) * 100) : 0
  }))
}

export function buildDimensionStats(artworks) {
  if (!artworks.length) return null
  const dims = ['color', 'composition', 'theme', 'expression']
  const labels = { color: '色彩运用', composition: '构图完整度', theme: '主题契合度', expression: '造型表现力' }
  return dims.map(d => {
    const values = artworks.map(a => a.scores?.[d] ?? 0).filter(v => v > 0)
    if (!values.length) return { key: d, label: labels[d], min: 0, max: 0, avg: 0 }
    return {
      key: d,
      label: labels[d],
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length)
    }
  })
}

export function generateClassCommentary(dimStats, colorDist) {
  if (!dimStats) return '暂无足够数据生成教学建议。'
  const parts = []

  const sorted = [...dimStats].sort((a, b) => a.avg - b.avg)
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]

  parts.push(`班级整体在「${strongest.label}」维度表现最佳（均分 ${strongest.avg}），在「${weakest.label}」维度相对薄弱（均分 ${weakest.avg}）。`)

  if (weakest.avg < 65) {
    parts.push(`建议在后续教学中加强「${weakest.label}」方面的针对性训练。`)
  }

  if (colorDist && colorDist.length > 0) {
    const coldColors = colorDist.filter(c => ['蓝', '青', '紫'].includes(c.color))
    const coldPct = coldColors.reduce((s, c) => s + (c.pct || 0), 0)
    if (coldPct < 20) {
      parts.push(`冷色系使用占比偏低（${coldPct}%），可在下一单元引导学生探索冷暖色对比表现。`)
    }
  }

  const range = strongest.max - strongest.min
  if (range > 40) {
    parts.push('班级内部分化较明显，建议关注低分段学生进行分层辅导。')
  }

  return parts.join('')
}

export function getGradeLetter(avgScore) {
  if (avgScore >= 85) return 'A'
  if (avgScore >= 70) return 'B'
  if (avgScore >= 60) return 'C'
  return 'D'
}

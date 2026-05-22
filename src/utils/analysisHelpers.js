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

// 班级观察笔记：纯描述性，不含"建议 / 应该"等行动性表述
// 视频脚本演示时教师会圈点其中的关键词
export function generateClassObservation(dimStats, colorDist) {
  if (!dimStats) return '暂无足够数据生成班级观察笔记。'
  const parts = []

  const sorted = [...dimStats].sort((a, b) => a.avg - b.avg)
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]

  parts.push(`本班在「${strongest.label}」维度表现最为活跃（均分 ${strongest.avg}），「${weakest.label}」维度相对薄弱（均分 ${weakest.avg}）。`)

  if (colorDist && colorDist.length > 0) {
    const coldColors = colorDist.filter(c => ['蓝', '青', '紫'].includes(c.color))
    const coldPct = coldColors.reduce((s, c) => s + (c.pct || 0), 0)
    const warmColors = colorDist.filter(c => ['红', '橙', '黄'].includes(c.color))
    const warmPct = warmColors.reduce((s, c) => s + (c.pct || 0), 0)
    if (coldPct < 20) {
      parts.push(`色彩运用整体偏暖（暖色占 ${warmPct}%、冷色仅 ${coldPct}%），冷色系出现偏少。`)
    } else {
      parts.push(`色彩运用整体活跃，冷暖色比例 ${warmPct}% / ${coldPct}%。`)
    }
  }

  const range = strongest.max - strongest.min
  if (range > 40) {
    parts.push('班级内部表达差异较为明显，存在多种风格倾向。')
  }

  return parts.join('')
}

// AI 教学建议：行动性建议，对应 Kimi 输出
export function generateClassCommentary(dimStats, colorDist) {
  if (!dimStats) return '暂无足够数据生成教学建议。'
  const parts = []

  const sorted = [...dimStats].sort((a, b) => a.avg - b.avg)
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]

  if (weakest.avg < 65) {
    parts.push(`建议在后续教学中加强「${weakest.label}」方面的针对性训练。`)
  }

  if (colorDist && colorDist.length > 0) {
    const coldColors = colorDist.filter(c => ['蓝', '青', '紫'].includes(c.color))
    const coldPct = coldColors.reduce((s, c) => s + (c.pct || 0), 0)
    if (coldPct < 20) {
      parts.push(`可在下一单元引导学生探索冷暖色对比表现。`)
    }
  }

  const range = strongest.max - strongest.min
  if (range > 40) {
    parts.push('班级内部分化较明显，建议关注低分段学生进行分层辅导。')
  }

  if (parts.length === 0) {
    parts.push(`班级整体表现均衡，建议保持现有教学节奏，可适度引入更具挑战的主题尝试。`)
  }

  return parts.join('')
}

export function getGradeLetter(avgScore) {
  if (avgScore >= 85) return 'A'
  if (avgScore >= 70) return 'B'
  if (avgScore >= 60) return 'C'
  return 'D'
}

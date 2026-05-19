import { describe, it, expect } from 'vitest'
import { getGradeLetter, buildColorDistribution, buildCompositionDistribution, buildGradeDistribution, buildDimensionStats, generateClassCommentary } from '../../src/utils/analysisHelpers'

describe('getGradeLetter', () => {
  it('returns A for 85+', () => {
    expect(getGradeLetter(90)).toBe('A')
    expect(getGradeLetter(85)).toBe('A')
  })
  it('returns B for 70-84', () => {
    expect(getGradeLetter(75)).toBe('B')
  })
  it('returns C for 60-69', () => {
    expect(getGradeLetter(65)).toBe('C')
  })
  it('returns D for below 60', () => {
    expect(getGradeLetter(50)).toBe('D')
  })
})

describe('buildColorDistribution', () => {
  it('returns array of color entries', () => {
    const artworks = [
      { scores: { colorDist: { red: 10, green: 20, blue: 30 } } },
      { scores: { colorDist: { red: 5, green: 10, blue: 5 } } }
    ]
    const result = buildColorDistribution(artworks)
    expect(Array.isArray(result)).toBe(true)
    const red = result.find(c => c.color === '红')
    expect(red.count).toBe(15)
    const green = result.find(c => c.color === '绿')
    expect(green.count).toBe(30)
  })

  it('returns empty array for empty input', () => {
    expect(buildColorDistribution([])).toEqual([])
  })
})

describe('buildCompositionDistribution', () => {
  it('returns array of composition types', () => {
    const artworks = [
      { scores: { compositionType: '居中式' } },
      { scores: { compositionType: '居中式' } },
      { scores: { compositionType: '满幅式' } }
    ]
    const result = buildCompositionDistribution(artworks)
    expect(Array.isArray(result)).toBe(true)
    const center = result.find(c => c.type === '居中式')
    expect(center.count).toBe(2)
    const full = result.find(c => c.type === '满幅式')
    expect(full.count).toBe(1)
  })
})

describe('buildGradeDistribution', () => {
  it('returns array of grade counts', () => {
    const artworks = [
      { grade: 'A', total_score: 90 },
      { grade: 'B', total_score: 75 },
      { grade: 'A', total_score: 88 }
    ]
    const result = buildGradeDistribution(artworks)
    expect(Array.isArray(result)).toBe(true)
    const a = result.find(g => g.grade === 'A')
    expect(a.count).toBe(2)
    const b = result.find(g => g.grade === 'B')
    expect(b.count).toBe(1)
  })
})

describe('buildDimensionStats', () => {
  it('returns array of dimension stats', () => {
    const artworks = [
      { scores: { color: 80, composition: 70, theme: 85, expression: 75 } },
      { scores: { color: 60, composition: 90, theme: 75, expression: 65 } }
    ]
    const result = buildDimensionStats(artworks)
    expect(Array.isArray(result)).toBe(true)
    const colorStat = result.find(d => d.key === 'color')
    expect(colorStat.avg).toBe(70)
    expect(colorStat.min).toBe(60)
    expect(colorStat.max).toBe(80)
  })
})

describe('generateClassCommentary', () => {
  it('returns commentary text with dimStats and colorDist', () => {
    const dimStats = [
      { key: 'color', label: '色彩运用', avg: 75, min: 60, max: 90 },
      { key: 'composition', label: '构图完整度', avg: 70, min: 50, max: 85 },
      { key: 'theme', label: '主题契合度', avg: 80, min: 65, max: 95 },
      { key: 'expression', label: '造型表现力', avg: 72, min: 55, max: 88 }
    ]
    const result = generateClassCommentary(dimStats, [])
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(10)
  })

  it('returns fallback for null dimStats', () => {
    const result = generateClassCommentary(null, null)
    expect(result).toBe('暂无足够数据生成教学建议。')
  })
})

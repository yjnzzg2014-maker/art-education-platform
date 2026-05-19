import { describe, it, expect } from 'vitest'
import { GRADE_COLORS, gradeColor } from '../../src/utils/gradeColors'

describe('gradeColors', () => {
  it('returns correct colors for each grade', () => {
    expect(GRADE_COLORS.A.bg).toBe('bg-green-100')
    expect(GRADE_COLORS.B.bg).toBe('bg-blue-100')
    expect(GRADE_COLORS.C.bg).toBe('bg-amber-100')
    expect(GRADE_COLORS.D.bg).toBe('bg-red-100')
  })

  it('gradeColor helper returns correct variant', () => {
    expect(gradeColor('A', 'bar')).toBe('bg-green-500')
    expect(gradeColor('D', 'bar')).toBe('bg-red-500')
  })

  it('gradeColor defaults to D for unknown grade', () => {
    expect(gradeColor('X', 'bg')).toBe('bg-red-100')
  })
})

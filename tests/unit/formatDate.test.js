import { describe, it, expect } from 'vitest'
import { formatDate, formatTime } from '../../src/utils/formatDate'

describe('formatDate', () => {
  it('returns formatted date string', () => {
    const result = formatDate('2024-03-15T10:30:00Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns empty string for falsy input', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate('')).toBe('')
  })

  it('formatTime returns full datetime', () => {
    const result = formatTime('2024-03-15T10:30:00Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})

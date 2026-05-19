export const GRADE_COLORS = {
  A: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500', border: 'border-green-500' },
  B: { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500', border: 'border-blue-500' },
  C: { bg: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500', border: 'border-amber-500' },
  D: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', border: 'border-red-500' }
}

export function gradeColor(grade, variant = 'bg') {
  return GRADE_COLORS[grade]?.[variant] || GRADE_COLORS.D[variant]
}

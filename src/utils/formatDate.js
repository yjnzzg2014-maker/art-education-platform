export function formatDate(dateStr, options = {}) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const locale = options.locale || 'zh-CN'
  if (options.format === 'datetime') {
    return date.toLocaleString(locale)
  }
  if (options.format === 'date') {
    return date.toLocaleDateString(locale)
  }
  return date.toLocaleDateString(locale)
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

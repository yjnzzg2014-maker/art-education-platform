const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

export default function DonutChart({ data }) {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">
        暂无数据
      </div>
    )
  }

  let items

  if (Array.isArray(data) && data.length > 0) {
    items = data.map((d, i) => ({
      label: d.type || d.label || `类型${i + 1}`,
      value: d.pct || d.value || 0,
      color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    }))
  } else if (data && typeof data === 'object') {
    const entries = Object.entries(data)
    if (entries.length === 0) {
      return <div className="flex items-center justify-center h-24 text-sm text-gray-400">暂无数据</div>
    }
    items = entries.map(([key, value], i) => ({
      label: key,
      value: typeof value === 'number' ? value : 0,
      color: DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    }))
  } else {
    return <div className="flex items-center justify-center h-24 text-sm text-gray-400">暂无数据</div>
  }

  const total = items.reduce((sum, i) => sum + i.value, 0) || 1

  return (
    <div className="flex gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
        {items.reduce((acc, item, i) => {
          const offset = acc.offset
          const dash = (item.value / total) * 251.3
          acc.elements.push(<circle key={i} cx="50" cy="50" r="40" fill="none" stroke={item.color} strokeWidth="18" strokeDasharray={`${dash} 251.3`} strokeDashoffset={-offset} />)
          acc.offset += dash
          return acc
        }, { elements: [], offset: 0 }).elements}
      </svg>
      <div className="flex-1 text-xs space-y-2 pt-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: item.color }}></div>
            <span className="flex-1">{item.label}</span>
            <span className="text-gray-400">{Math.round((item.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

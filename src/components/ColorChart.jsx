const FILL_COLORS = {
  '红': '#ef4444', '橙': '#f97316', '黄': '#eab308', '绿': '#22c55e',
  '青': '#06b6d4', '蓝': '#3b82f6', '紫': '#8b5cf6', '粉': '#ec4899',
  '棕': '#a16207', '灰': '#6b7280', '黑': '#1f2937'
}
const FALLBACK_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#a16207','#6b7280','#1f2937']

export default function ColorChart({ data }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <div className="h-28 flex items-center justify-center text-gray-400 text-sm">暂无数据</div>
  }

  const maxPct = Math.max(...data.map(d => d.pct || 0), 1)

  return (
    <div>
      <div className="flex items-end gap-1 h-28 mb-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="text-xs text-gray-500 mb-1">{d.pct || 0}%</div>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${((d.pct || 0) / maxPct) * 80}%`,
                minHeight: d.pct > 0 ? '4px' : '0',
                backgroundColor: FILL_COLORS[d.color] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        {data.map((d, i) => <span key={i} className="flex-1 text-center">{d.color}</span>)}
      </div>
    </div>
  )
}

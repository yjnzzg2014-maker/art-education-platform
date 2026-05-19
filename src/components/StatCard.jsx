export default function StatCard({ label, value, unit, trend, trendType }) {
  const trendColors = { up: 'text-green-500', down: 'text-red-500', warn: 'text-amber-500' }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>{label}</span>
        {trend && <span className={trendColors[trendType] || ''}>{trend}</span>}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}</div>
    </div>
  )
}

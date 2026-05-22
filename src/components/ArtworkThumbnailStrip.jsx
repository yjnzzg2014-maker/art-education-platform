import MaskName from './MaskName'
import { getAnomalyLevel } from './ArtworkGrid'

export default function ArtworkThumbnailStrip({ artworks, selectedId, onSelect }) {
  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {artworks.map(art => (
        <div key={art.id}
          onClick={() => onSelect(art)}
          className={`flex-shrink-0 w-24 border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
            selectedId === art.id
              ? 'border-red-500 ring-2 ring-red-200 shadow-sm'
              : 'border-gray-200 hover:border-blue-400'
          }`}>
          <div className="h-24 relative bg-gray-100">
            {art.image_url ? (
              <img src={art.image_url} alt={art.student_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100" />
            )}
            {art.is_anomaly && (() => {
              const level = getAnomalyLevel(art)
              if (level === 'warn') {
                return (
                  <span
                    className="absolute top-1 right-1 bg-red-600 text-white px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap leading-none animate-pulse"
                    style={{ fontSize: '10px' }}
                    title={`系统警告：${art.anomaly_reason || '需教师关注'}`}
                  >
                    ⚠ 需关注
                  </span>
                )
              }
              return (
                <span
                  className="absolute top-1 right-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap leading-none"
                  style={{ fontSize: '10px' }}
                  title="系统提示：这幅作品值得多看一眼"
                >
                  值得多看
                </span>
              )
            })()}
          </div>
          <div className="p-2 text-center">
            <div className="text-xs text-gray-700 font-medium truncate"><MaskName name={art.student_name} /></div>
            {art.total_score != null && (
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="text-sm font-semibold text-gray-800">{art.total_score}</span>
                {art.grade && (
                  <span className={`${gradeColors[art.grade]} text-white px-1.5 rounded text-xs font-medium`}>
                    {art.grade}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

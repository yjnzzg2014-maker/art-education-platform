import { useState } from 'react'
import MaskName from './MaskName'

// 根据 anomaly_reason 关键字区分"系统警告"（红）与"值得多看一眼"（琥珀）
const WARN_RE = /深色|压抑|重点关注|需关注|情绪/
export const getAnomalyLevel = (art) => {
  if (!art?.is_anomaly) return null
  return WARN_RE.test(art.anomaly_reason || '') ? 'warn' : 'notice'
}

export default function ArtworkGrid({ artworks, selectedId, onSelect, compact }) {
  const [dims, setDims] = useState({})

  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }

  const getHeight = (art) => {
    const d = dims[art.id]
    if (d && d.w && d.h) {
      return d.h > d.w * 1.1 ? '8rem' : compact ? '5rem' : '6rem'
    }
    return compact ? '5rem' : '6rem'
  }

  return (
    <div className={compact ? 'grid grid-cols-8 gap-2' : 'grid grid-cols-6 gap-3'}>
      {artworks.map(art => {
        const imgHeight = getHeight(art)
        const showScore = !compact && art.total_score != null && art.total_score > 0

        return (
          <div
            key={art.id}
            onClick={() => onSelect(art)}
            className={`border rounded overflow-hidden cursor-pointer transition-colors ${
              selectedId === art.id
                ? 'border-red-500 ring-2 ring-red-200'
                : 'border-gray-200 hover:border-blue-400'
            }`}
          >
            {/* Image container */}
            <div className="relative bg-gray-100 overflow-hidden" style={{ height: imgHeight }}>
              {art.image_url ? (
                <img
                  src={art.image_url}
                  alt={art.student_name}
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    const img = e.target
                    if (img.naturalWidth && img.naturalHeight) {
                      setDims(prev => ({ ...prev, [art.id]: { w: img.naturalWidth, h: img.naturalHeight } }))
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100" />
              )}
              {art.is_anomaly && (() => {
                const level = getAnomalyLevel(art)
                if (level === 'warn') {
                  return (
                    <span
                      className="absolute top-1 right-1 bg-red-600 text-white px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap leading-none animate-pulse"
                      style={{ fontSize: '10px' }}
                      title={`系统警告：${art.anomaly_reason || '需教师关注'}`}
                    >
                      ⚠ 需教师关注
                    </span>
                  )
                }
                return (
                  <span
                    className="absolute top-1 right-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap leading-none"
                    style={{ fontSize: '10px' }}
                    title="系统提示：这幅作品值得多看一眼"
                  >
                    值得多看一眼
                  </span>
                )
              })()}
            </div>

            {/* Info section */}
            <div className={`${compact ? 'p-1.5' : 'p-2'} text-xs`}>
              <div className="font-medium text-gray-700 truncate">
                <MaskName name={art.student_name} />
              </div>
              {showScore && (
                <div className="flex justify-between text-gray-500 mt-1">
                  <span>{art.total_score}</span>
                  <span className={`${gradeColors[art.grade]} text-white px-1 rounded text-xs`}>
                    {art.grade}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

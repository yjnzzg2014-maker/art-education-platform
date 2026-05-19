import MaskName from './MaskName'

export default function ArtworkGrid({ artworks, selectedId, onSelect, compact }) {
  const gradeColors = { A: 'bg-green-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500' }

  return (
    <div className={compact ? 'grid grid-cols-8 gap-2' : 'grid grid-cols-6 gap-3'}>
      {artworks.map(art => (
        <div key={art.id}
          onClick={() => onSelect(art)}
          className={`border rounded overflow-hidden cursor-pointer transition-colors ${
            selectedId === art.id
              ? 'border-red-500 ring-2 ring-red-200'
              : 'border-gray-200 hover:border-blue-400'
          }`}>
          <div className={`${compact ? 'h-16' : 'h-22'} relative bg-gray-100`}>
            {art.image_url ? (
              <img src={art.image_url} alt={art.student_name} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100" />
            )}
            {art.is_anomaly && <span className="absolute top-1 right-1 bg-red-500 text-white text-xs px-1 rounded">异常</span>}
          </div>
          <div className={`${compact ? 'p-1.5' : 'p-2'} text-xs`}>
            <div className="font-medium text-gray-700 truncate"><MaskName name={art.student_name} /></div>
            {!compact && art.total_score != null && (
              <div className="flex justify-between text-gray-500 mt-1">
                <span>{art.total_score}</span>
                <span className={`${gradeColors[art.grade]} text-white px-1 rounded text-xs`}>{art.grade}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

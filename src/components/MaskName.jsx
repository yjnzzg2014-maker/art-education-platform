import { useMaskStore } from '../stores/maskStore'

export default function MaskName({ name, className = '' }) {
  const masked = useMaskStore(s => s.masked)
  if (!name) return null
  if (!masked) return <span className={className}>{name}</span>
  const chars = name.split('')
  const masked_ = chars.map((c, i) => {
    if (i === 0) return c
    if (/[a-zA-Z]/.test(c)) return '*'
    if (/\d/.test(c)) return '*'
    return '*'
  }).join('')
  return <span className={className}>{masked_}</span>
}

import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..', '..')

export function resolveImagePath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null
  if (imageUrl.startsWith('/api/upload/')) {
    return path.join(PROJECT_ROOT, 'uploads', imageUrl.replace('/api/upload/', ''))
  }
  if (imageUrl.startsWith('/uploads/')) {
    return path.join(PROJECT_ROOT, 'uploads', imageUrl.replace('/uploads/', ''))
  }
  if (imageUrl.startsWith('/images/')) {
    return path.join(PROJECT_ROOT, 'public', imageUrl)
  }
  return null
}

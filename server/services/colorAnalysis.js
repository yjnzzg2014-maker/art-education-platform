import sharp from 'sharp'
import { resolveImagePath } from '../utils/imagePath.js'

const SAMPLE_SIZE = 200

export async function analyzeImageColors(imageUrl) {
  const filePath = resolveImagePath(imageUrl)
  if (!filePath) return null

  try {
    const { data, info } = await sharp(filePath)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const pixelCount = info.width * info.height
    const counts = { red: 0, orange: 0, yellow: 0, green: 0, cyan: 0, blue: 0, purple: 0, pink: 0, brown: 0, gray: 0, black: 0 }

    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const category = classifyPixel(r, g, b)
      counts[category]++
    }

    const dist = {}
    for (const key of Object.keys(counts)) {
      dist[key] = Math.round((counts[key] / pixelCount) * 100)
    }

    return dist
  } catch (err) {
    console.error('Color analysis failed:', err.message)
    return null
  }
}

function classifyPixel(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b)

  // Very dark -> black
  if (l < 12) return 'black'
  // Very light with no saturation -> gray (white counted as gray)
  if (l > 90 && s < 15) return 'gray'
  // Low saturation -> gray or brown
  if (s < 12) {
    return l < 45 ? 'black' : 'gray'
  }

  // Low-mid lightness + warm hue + low-mid saturation -> brown
  if (l < 45 && s < 55 && (h < 40 || h >= 340)) return 'brown'
  if (l >= 20 && l < 50 && s >= 12 && s < 65 && h >= 15 && h < 45) return 'brown'

  // Pink: high lightness + red-magenta hue
  if (l >= 55 && s >= 20 && ((h >= 320 && h < 360) || h < 15)) return 'pink'

  // Chromatic classification by hue
  if (h < 12) return 'red'
  if (h < 38) return 'orange'
  if (h < 65) return 'yellow'
  if (h < 160) return 'green'
  if (h < 195) return 'cyan'
  if (h < 260) return 'blue'
  if (h < 320) return 'purple'
  return 'red' // 320-360
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s * 100, l * 100]
}

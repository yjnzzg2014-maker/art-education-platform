import fs from 'fs'
import path from 'path'
import { dbGet } from '../db.js'
import { analyzeImageColors } from './colorAnalysis.js'
import { decrypt } from '../utils/crypto.js'
import { resolveImagePath } from '../utils/imagePath.js'

const VLM_API_URL = 'https://api.minimaxi.com/v1/coding_plan/vlm'
const REQUEST_TIMEOUT = 60000
const MAX_RETRIES = 2

async function getApiKey() {
  try {
    const row = await dbGet('SELECT value FROM settings WHERE key = ?', ['minimax_api_key'])
    if (row?.value) return decrypt(row.value)
  } catch {}
  return process.env.MINIMAX_API_KEY || ''
}

function clamp(v) {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)))
}

function tryParseJSON(str) {
  try {
    const cleaned = str.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch { return null }
}

function imageToBase64DataUrl(filePath) {
  const data = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.png' ? 'png' : ext === '.webp' ? 'webp' : 'jpeg'
  return `data:image/${mime};base64,${data.toString('base64')}`
}

function buildVLMPrompt(theme) {
  return `你是一位小学美术教育评估专家。请仔细观察这幅小学生的绘画作品，并进行四维评分。

作业主题：${theme}

请直接返回JSON，禁止输出任何分析过程、思考步骤或额外文字。只返回一个JSON对象：
{
  "color": <0-100 色彩运用分数，评估色彩丰富度、协调性、冷暖对比>,
  "composition": <0-100 构图完整度分数，评估画面布局、空间层次、主体位置>,
  "theme": <0-100 主题契合度分数，评估画面内容与主题的匹配程度>,
  "expression": <0-100 造型表现力分数，评估线条质量、形象生动性、创造力>,
  "commentary": "<80-150字的中文综合评语，分别点评四个维度的亮点和不足>",
  "summary": "<30-50字的总评，概括作品整体水平和最突出的特点>"
}

评分标准：
- 色彩：色彩种类丰富、搭配协调得高分；单调灰暗得低分
- 构图：画面饱满有层次、主体突出得高分；过于空洞或杂乱得低分
- 主题：画面内容明确体现主题得高分；与主题无关得低分
- 表现力：线条自信流畅、形象生动有创意得高分；僵硬呆板得低分
- 评语要求：语气亲切鼓励，适合小学生阅读，先肯定亮点再提改进建议`
}

export async function analyzeArtwork(imageUrl, theme) {
  const colorDist = await analyzeImageColors(imageUrl)
  const compositionType = detectCompositionType(colorDist)

  const apiKey = await getApiKey()
  const filePath = resolveImagePath(imageUrl)

  if (!apiKey || !filePath || !fs.existsSync(filePath)) {
    if (!apiKey) console.log('[MiniMax] 未配置 API Key，使用本地算法')
    else console.log('[MiniMax] 图片文件不存在:', imageUrl)
    return localAnalyze(theme, colorDist, compositionType)
  }

  let lastError
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

      const base64Url = imageToBase64DataUrl(filePath)
      const prompt = buildVLMPrompt(theme)

      console.log('[MiniMax] VLM 请求:', VLM_API_URL, '图片大小:', Math.round(base64Url.length / 1024), 'KB')

      const response = await fetch(VLM_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          image_url: base64Url
        }),
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`VLM API ${response.status}: ${body.slice(0, 200)}`)
      }

      const data = await response.json()

      if (data.base_resp?.status_code !== 0) {
        throw new Error(`VLM API error: ${data.base_resp?.status_msg || 'unknown'}`)
      }

      const content = data.content || ''
      console.log('[MiniMax] VLM 返回:', content.slice(0, 300))

      return parseVLMResponse(content, theme, colorDist, compositionType)
    } catch (err) {
      lastError = err.name === 'AbortError' ? new Error('VLM API timeout') : err
      console.warn(`[MiniMax] VLM 第${attempt + 1}次尝试失败:`, lastError.message)
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  console.warn('[MiniMax] VLM API 失败，回退到本地算法:', lastError.message)
  return localAnalyze(theme, colorDist, compositionType)
}

function parseVLMResponse(content, theme, colorDist, compositionType) {
  const parsed = tryParseJSON(content)

  if (parsed && typeof parsed.color === 'number') {
    const color = clamp(parsed.color)
    const composition = clamp(parsed.composition)
    const themeScore = clamp(parsed.theme)
    const expression = clamp(parsed.expression)
    const commentary = typeof parsed.commentary === 'string' ? parsed.commentary : generateCommentary({ color, composition, theme: themeScore, expression })
    const summary = typeof parsed.summary === 'string' ? parsed.summary : null

    console.log('[MiniMax] VLM AI 分析成功')
    const result = buildResult({ color, composition, theme: themeScore, expression }, commentary, colorDist, compositionType, theme, summary)
    result.source = 'ai'
    return result
  }

  // VLM 返回了文字但不是 JSON，尝试从文字中提取信息
  if (content.length > 50) {
    console.warn('[MiniMax] VLM 返回非JSON格式，尝试从文字提取')
    console.warn('[MiniMax] 原始内容:', content.slice(0, 500))
  }

  console.warn('[MiniMax] VLM 返回无法解析，回退到本地算法')
  return localAnalyze(theme, colorDist, compositionType)
}

function buildResult(scores, commentary, colorDist, compositionType, theme, summary) {
  const { color, composition, theme: themeScore, expression } = scores
  const totalScore = Math.round((color + composition + themeScore + expression) / 4)
  const grade = totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : 'D'

  const darkRatio = colorDist ? (colorDist.black || 0) + (colorDist.brown || 0) : 0
  const isAnomaly = darkRatio > 60 || themeScore < 40
  const reason = isAnomaly
    ? `主色调为深色系（占比${darkRatio}%），与${theme}主题匹配度仅${themeScore}%`
    : null

  return {
    scores: { color, composition, theme: themeScore, expression, colorDist, compositionType, commentary, summary },
    grade,
    totalScore,
    isAnomaly,
    reason
  }
}

function generateCommentary(scores) {
  const parts = []
  const { color, composition, theme, expression } = scores

  if (color >= 80) parts.push('色彩运用丰富且协调，展现出较强的色彩感知力')
  else if (color >= 60) parts.push('色彩运用基本得当，建议尝试更多冷暖对比')
  else parts.push('色彩运用较为单一，需加强色彩搭配训练')

  if (composition >= 80) parts.push('构图完整有层次，空间布局合理')
  else if (composition >= 60) parts.push('构图基本完整，可进一步优化画面重心')
  else parts.push('构图尚需改善，建议参考经典构图范式练习')

  if (theme >= 80) parts.push('主题表达清晰，内容紧扣主题要求')
  else if (theme >= 60) parts.push('主题有所体现，但表达力度可加强')
  else parts.push('主题契合度偏低，需引导学生深入理解主题')

  if (expression >= 80) parts.push('造型表现力突出，线条流畅自信')
  else if (expression >= 60) parts.push('造型表现中规中矩，鼓励大胆尝试')
  else parts.push('造型表现力不足，建议加强基础造型训练')

  return parts.join('；') + '。'
}

const SPRING_KEYWORDS = ['春', '花', '芽', '蝶', '风筝', '柳', '草', '苗']

function scoreColorFromDist(colorDist) {
  if (!colorDist) return 70
  const chromatic = 100 - (colorDist.gray || 0) - (colorDist.black || 0)
  const uniqueColors = Object.entries(colorDist).filter(([k, v]) => !['gray', 'black'].includes(k) && v >= 5).length
  return clamp(40 + chromatic * 0.3 + uniqueColors * 5)
}

function scoreThemeFromDist(colorDist, theme) {
  if (!colorDist) return 70
  const isSpring = SPRING_KEYWORDS.some(kw => theme.includes(kw))
  if (isSpring) {
    const springColors = (colorDist.green || 0) + (colorDist.yellow || 0) + (colorDist.pink || 0) + (colorDist.cyan || 0)
    const darkColors = (colorDist.black || 0) + (colorDist.brown || 0) + (colorDist.gray || 0)
    return clamp(30 + springColors * 0.9 - darkColors * 0.3)
  }
  const variety = Object.values(colorDist).filter(v => v >= 5).length
  return clamp(60 + variety * 3)
}

function detectCompositionType(colorDist) {
  if (!colorDist) return '居中式'
  const dominant = Object.entries(colorDist)
    .filter(([k]) => !['gray', 'black'].includes(k))
    .sort((a, b) => b[1] - a[1])
  const topPct = dominant[0]?.[1] || 0
  if (topPct >= 45) return '满幅式'
  if (topPct >= 30) return '居中式'
  const spread = dominant.filter(([, v]) => v >= 8).length
  if (spread >= 5) return '分割式'
  return '留白式'
}

function localAnalyze(theme, colorDist, compositionType) {
  compositionType = compositionType || detectCompositionType(colorDist)
  const colorScore = scoreColorFromDist(colorDist)
  const themeScore = scoreThemeFromDist(colorDist, theme)

  const compBase = compositionType === '居中式' ? 78 : compositionType === '满幅式' ? 72 : compositionType === '分割式' ? 75 : 70
  const colorVariety = colorDist ? Object.values(colorDist).filter(v => v >= 3).length : 5
  const composition = clamp(compBase + colorVariety)
  const chromatic = colorDist ? 100 - (colorDist.gray || 0) - (colorDist.black || 0) : 70
  const expression = clamp(55 + Math.round(chromatic * 0.3) + colorVariety)

  const scores = { color: colorScore, composition, theme: themeScore, expression }
  const commentary = generateCommentary(scores)

  const result = buildResult(scores, commentary, colorDist, compositionType, theme)
  result.source = 'local'
  return result
}

export default { analyzeArtwork }

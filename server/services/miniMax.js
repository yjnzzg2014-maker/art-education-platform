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

评分标准（鼓励为主，保持区分度）：
- 色彩：用色丰富大胆得88-98分；有色彩搭配意识得82-90分；单调灰暗得65-82分
- 构图：布局有层次得88-98分；有基本构图意识得82-90分；杂乱无章得65-82分
- 主题：紧扣主题得88-98分；有所关联得82-90分；偏离主题得65-82分
- 表现力：线条自信有创意得88-98分；有个人特色得82-90分；僵硬生疏得65-82分
- 请尽量拉开各维度分数档次，不要所有维度都给相近分数
- 评语：语气温暖鼓励，适合小学生阅读，先肯定亮点再提改进建议`
}

export async function analyzeArtwork(imageUrl, theme, signal) {
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
      if (signal) signal.addEventListener('abort', () => controller.abort())

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
  const grade = totalScore >= 88 ? 'A' : totalScore >= 85 ? 'B' : totalScore >= 80 ? 'C' : 'D'

  const darkRatio = colorDist ? (colorDist.black || 0) + (colorDist.brown || 0) : 0
  const isAnomaly = darkRatio > 70 || themeScore < 30
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

  if (color >= 80) parts.push('色彩运用大胆丰富，搭配很有想法')
  else if (color >= 65) parts.push('色彩搭配有进步空间，目前用色已经很有自己的想法')
  else parts.push('对色彩有自己的感受，可以尝试更多喜欢的颜色')

  if (composition >= 80) parts.push('构图布局有章法，画面层次感不错')
  else if (composition >= 65) parts.push('构图意识已有体现，画面越来越有条理了')
  else parts.push('在构图上有自己的想法，继续多观察多尝试')

  if (theme >= 80) parts.push('主题表达清晰到位，内容很贴合作业要求')
  else if (theme >= 65) parts.push('主题有所体现，能看出在努力表达')
  else parts.push('对主题有自己的理解，表达方式很独特')

  if (expression >= 80) parts.push('造型表现力出色，线条自信有感染力')
  else if (expression >= 65) parts.push('造型上有自己的特色，大胆画下去一定更好')
  else parts.push('有独特的表达方式，这正是创造力的萌芽')

  return parts.join('，') + '。'
}

const SPRING_KEYWORDS = ['春', '花', '芽', '蝶', '风筝', '柳', '草', '苗']

function scoreColorFromDist(colorDist) {
  if (!colorDist) return 85
  const chromatic = 100 - (colorDist.gray || 0) - (colorDist.black || 0)
  const uniqueColors = Object.entries(colorDist).filter(([k, v]) => !['gray', 'black'].includes(k) && v >= 5).length
  return clamp(65 + chromatic * 0.2 + uniqueColors * 3)
}

function scoreThemeFromDist(colorDist, theme) {
  if (!colorDist) return 85
  const isSpring = SPRING_KEYWORDS.some(kw => theme.includes(kw))
  if (isSpring) {
    const springColors = (colorDist.green || 0) + (colorDist.yellow || 0) + (colorDist.pink || 0) + (colorDist.cyan || 0)
    const darkColors = (colorDist.black || 0) + (colorDist.brown || 0) + (colorDist.gray || 0)
    return clamp(60 + springColors * 0.7 - darkColors * 0.15)
  }
  const variety = Object.values(colorDist).filter(v => v >= 5).length
  return clamp(75 + variety * 3)
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

  const compBase = compositionType === '居中式' ? 85 : compositionType === '满幅式' ? 82 : compositionType === '分割式' ? 84 : 78
  const colorVariety = colorDist ? Object.values(colorDist).filter(v => v >= 3).length : 5
  const composition = clamp(compBase + colorVariety)
  const chromatic = colorDist ? 100 - (colorDist.gray || 0) - (colorDist.black || 0) : 70
  const expression = clamp(70 + Math.round(chromatic * 0.15) + colorVariety)

  const scores = { color: colorScore, composition, theme: themeScore, expression }
  const commentary = generateCommentary(scores)

  const result = buildResult(scores, commentary, colorDist, compositionType, theme)
  result.source = 'local'
  return result
}

const DIM_LABELS = { color: '色彩运用', composition: '构图完整度', theme: '主题契合度', expression: '造型表现力' }

function buildTeachingPrompt(taskTheme, className, dimStats, colorDist, compDist, grades, totalCount, anomalyCount) {
  const dimText = dimStats.map(d => `「${d.label}」均分 ${d.avg}（范围 ${d.min}-${d.max}）`).join('、')
  const topColor = colorDist.slice(0, 3).filter(c => c.pct > 0).map(c => `${c.color}色(${c.pct}%)`).join('、') || '无明显主色'
  const gradeText = Object.entries(grades).filter(([, cnt]) => cnt > 0).map(([g, cnt]) => `${g}级${cnt}人`).join('、') || '暂无评级数据'

  // 判断是否"零数据 / 极少数据"语境
  const hasAnyDimData = dimStats.some(d => d.avg > 0)
  const isEmptyData = totalCount === 0 || !hasAnyDimData

  if (isEmptyData) {
    return `你是一位资深小学美术教研专家。某课题的班级AI分析数据目前尚处于空白状态（暂无作品提交或评分），但教师希望在正式分析开始前获得一份高质量的教学参考，作为本课题教学导入阶段的参考依据。

班级信息：${className}
作业主题：${taskTheme}
当前数据状态：暂无AI分析数据（${totalCount === 0 ? '尚未提交作品' : '作品已提交但评分尚未生成'}）

请基于"${taskTheme}"这一主题本身的教学规律生成一段教学参考（260-350字），要求：

1. 开篇明确指出"从本次AI分析数据来看，目前班级作品提交及评级尚处于空白状态"，提示在教学导入阶段需关注学生创作动机的激发
2. 围绕"色彩运用 / 构图完整度 / 主题契合度 / 造型表现力"这四个维度，按重要性顺序为该主题给出具体可操作的教学策略；每个维度给出一个具名的教学方法（例如"微观观察法""取景框教学""色彩搜集游戏"等），并简述实施步骤
3. 提示教师在零数据/低提交语境下应排查学生畏难情绪，建议通过前置活动降低创作门槛
4. 整体语气专业、温暖、富有启发，像写给同行教师的一段教研笔记
5. 段落自然衔接，禁止使用项目符号、编号、标题、加粗等格式标记；禁止机械重复维度名称
6. 直接返回正文，不要加任何标题或格式标记`
  }

  return `你是一位资深小学美术教研专家。以下是某班级本次作业的AI分析数据，请据此生成精准有效的教学建议。

班级信息：${className}
作业主题：${taskTheme}
分析作品数：${totalCount}幅
评级分布：${gradeText}
关注作品（异常）：${anomalyCount}幅

四维评分统计：
${dimStats.map(d => `  - ${d.label}：均分${d.avg}，最低${d.min}，最高${d.max}`).join('\n')}

色彩分布（占比前三位）：${topColor}

构图类型分布：${compDist.filter(c => c.count > 0).map(c => `${c.type}${c.count}人`).join('、') || '暂无数据'}

请生成一段教学建议（200-300字），要求：
1. 针对班级薄弱维度提供具体可操作的教学策略（给出具名教学方法，如"微观观察法""取景框教学""色彩搜集游戏"等）
2. 结合数据指出优势保持与改进方向
3. 对关注作品提出个别化辅导建议
4. 语言专业、亲切，适合教师阅读
5. 段落自然衔接，禁止使用项目符号、编号、标题、加粗等格式标记
6. 直接返回建议正文，不要加任何标题或格式标记`
}

export async function generateTeachingSuggestions(taskTheme, className, dimStats, colorDist, compDist, grades, totalCount, anomalyCount) {
  const apiKey = await getApiKey()
  if (!apiKey) return null

  const prompt = buildTeachingPrompt(taskTheme, className, dimStats, colorDist, compDist, grades, totalCount, anomalyCount)

  let lastError
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(VLM_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==' }),
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!response.ok) throw new Error(`VLM API ${response.status}`)

      const data = await response.json()
      if (data.base_resp?.status_code !== 0) throw new Error(data.base_resp?.status_msg || 'API error')

      const content = (data.content || '').trim()
      console.log('[MiniMax] 教学建议生成成功:', content.slice(0, 100))
      return content
    } catch (err) {
      lastError = err.name === 'AbortError' ? new Error('VLM API timeout') : err
      console.warn(`[MiniMax] 教学建议第${attempt + 1}次尝试失败:`, lastError.message)
      if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  console.warn('[MiniMax] 教学建议生成失败:', lastError.message)
  return null
}

function buildObservationPrompt(taskTheme, className, dimStats, colorDist, compDist, grades, totalCount, anomalyCount) {
  const dimText = dimStats.map(d => `「${d.label}」均分 ${d.avg}（范围 ${d.min}-${d.max}）`).join('、')
  const topColor = colorDist.slice(0, 3).filter(c => c.pct > 0).map(c => `${c.color}色(${c.pct}%)`).join('、') || '无明显主色'
  const gradeText = Object.entries(grades).filter(([, cnt]) => cnt > 0).map(([g, cnt]) => `${g}级${cnt}人`).join('、') || '暂无评级数据'

  return `你是一位资深小学美术教师。以下是某班级本次作业的AI分析数据，请据此生成"班级观察笔记"。

班级信息：${className}
作业主题：${taskTheme}
分析作品数：${totalCount}幅
评级分布：${gradeText}
关注作品：${anomalyCount}幅

四维评分统计：
${dimStats.map(d => `  - ${d.label}：均分${d.avg}，最低${d.min}，最高${d.max}`).join('\n')}

色彩分布（占比前三位）：${topColor}
构图类型分布：${compDist.filter(c => c.count > 0).map(c => `${c.type}${c.count}人`).join('、') || '暂无数据'}

请生成一段"班级观察笔记"（150-220字），要求：
1. 纯描述性语气，不出现"建议、应该、推荐"等行动词
2. 客观陈述班级在色彩、构图、主题、造型上的整体倾向与差异
3. 指出个性化表达（关注作品）的可能价值
4. 语言亲切自然，像教师课后随笔
5. 直接返回正文,不要加标题或格式标记`
}

export async function generateClassObservation(taskTheme, className, dimStats, colorDist, compDist, grades, totalCount, anomalyCount) {
  const apiKey = await getApiKey()
  if (!apiKey) return null

  const prompt = buildObservationPrompt(taskTheme, className, dimStats, colorDist, compDist, grades, totalCount, anomalyCount)

  let lastError
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(VLM_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==' }),
        signal: controller.signal
      })

      clearTimeout(timer)
      if (!response.ok) throw new Error(`VLM API ${response.status}`)

      const data = await response.json()
      if (data.base_resp?.status_code !== 0) throw new Error(data.base_resp?.status_msg || 'API error')

      const content = (data.content || '').trim()
      console.log('[MiniMax] 班级观察笔记生成成功:', content.slice(0, 100))
      return content
    } catch (err) {
      lastError = err.name === 'AbortError' ? new Error('VLM API timeout') : err
      console.warn(`[MiniMax] 班级观察笔记第${attempt + 1}次尝试失败:`, lastError.message)
      if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  console.warn('[MiniMax] 班级观察笔记生成失败:', lastError.message)
  return null
}

function buildLongitudinalPrompt(className, timeline, colorTrend, compTrend, gradeTrend) {
  const timelineText = timeline.map((t, i) =>
    `  ${i + 1}. ${t.date.slice(0, 10)}「${t.theme}」(${t.count}人)：色彩${t.dims.color} 构图${t.dims.composition} 主题${t.dims.theme} 造型${t.dims.expression}`
  ).join('\n')

  const colorTopText = colorTrend.slice(0, 4).map(c => `${c.color}色${c.pct}%`).join('、') || '无明显主色'
  const compTopText = compTrend.slice(0, 3).map(c => `${c.type}${c.pct}%`).join('、') || '暂无构图统计'
  const gradeText = Object.entries(gradeTrend).filter(([, n]) => n > 0).map(([g, n]) => `${g}级${n}人次`).join('、') || '暂无评级数据'

  return `你是一位资深小学美术教研员。以下是某班级最近一段时间（${timeline.length} 次课堂作业）累积的 AI 分析数据，请基于"时间维度的趋势"生成跨任务的教学建议。

班级：${className}
作业次数：${timeline.length}
作品总数：${timeline.reduce((s, t) => s + t.count, 0)}
累计评级：${gradeText}

各次作业的四维均分（按时间顺序）：
${timelineText}

累计色彩倾向（占比前列）：${colorTopText}
累计构图类型（占比前列）：${compTopText}

请生成一段"班级阶段性教学建议"（260-360字），要求：
1. 必须基于"时间趋势"而非单次作业——指出哪些维度在持续提升、哪些长期偏弱
2. 给出 2-3 条具体可操作的下节课/下阶段引导策略（例如"画面呼吸的空间""微观观察""单一冷色场景"等）
3. 把建议写成教研员对一线教师的口吻，亲切、克制、留有判断余地
4. 末尾自然带出"这只是辅助参考，是否采纳由教师结合课堂自主决定"的意思（不要照抄这句话，融入语意即可）
5. 禁止使用项目符号、编号、标题、加粗等任何 Markdown 格式
6. 直接返回正文，不要加任何前后缀`
}

export async function generateClassLongitudinalSuggestion(className, timeline, colorTrend, compTrend, gradeTrend) {
  const apiKey = await getApiKey()
  if (!apiKey) return null

  const prompt = buildLongitudinalPrompt(className, timeline, colorTrend, compTrend, gradeTrend)

  let lastError
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 60000)

      const response = await fetch(VLM_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==' }),
        signal: controller.signal
      })

      clearTimeout(timer)
      if (!response.ok) throw new Error(`VLM API ${response.status}`)

      const data = await response.json()
      if (data.base_resp?.status_code !== 0) throw new Error(data.base_resp?.status_msg || 'API error')

      const content = (data.content || '').trim()
      console.log('[MiniMax] 班级阶段教学建议生成成功:', content.slice(0, 100))
      return content
    } catch (err) {
      lastError = err.name === 'AbortError' ? new Error('VLM API timeout') : err
      console.warn(`[MiniMax] 班级阶段教学建议第${attempt + 1}次尝试失败:`, lastError.message)
      if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  console.warn('[MiniMax] 班级阶段教学建议生成失败:', lastError.message)
  return null
}

export default { analyzeArtwork, generateTeachingSuggestions, generateClassObservation, generateClassLongitudinalSuggestion }

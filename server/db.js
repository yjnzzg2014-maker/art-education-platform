import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'artedu.db')

// 打开数据库（sqlite3 使用回调或 promise）
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err)
    process.exit(1)
  }
  console.log('Database connected:', dbPath)
})

// 启用外键和 WAL 模式
db.run('PRAGMA foreign_keys = ON')
db.run('PRAGMA journal_mode = WAL')

// Promisify sqlite3 methods for async/await (must be after db is defined)
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
})
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
})
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes }) })
})
const dbExec = (sql) => new Promise((resolve, reject) => {
  db.exec(sql, (err) => err ? reject(err) : resolve())
})

// 初始化数据库表
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'admin')),
        school_id INTEGER REFERENCES schools(id),
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id INTEGER REFERENCES schools(id),
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_id INTEGER REFERENCES grades(id),
        name TEXT NOT NULL,
        teacher_id INTEGER REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER REFERENCES classes(id),
        name TEXT NOT NULL,
        student_no TEXT,
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS artworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER REFERENCES students(id),
        task_id INTEGER REFERENCES analysis_tasks(id),
        title TEXT,
        image_url TEXT NOT NULL,
        theme TEXT,
        upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        scores TEXT CHECK(scores IS NULL OR json_valid(scores)),
        grade TEXT CHECK(grade IN ('A','B','C','D')),
        total_score INTEGER,
        is_anomaly INTEGER DEFAULT 0,
        anomaly_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS teacher_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artwork_id INTEGER REFERENCES artworks(id),
        teacher_id INTEGER REFERENCES users(id),
        comment TEXT,
        override INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS token_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL,
        user_id INTEGER REFERENCES users(id),
        expires_at DATETIME NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analysis_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER REFERENCES classes(id),
        teacher_id INTEGER REFERENCES users(id),
        theme TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending','processing','completed','failed')),
        result_summary TEXT,
        research_conclusion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `, (err) => {
      if (err) {
        console.error('Failed to create tables:', err)
        reject(err)
      } else {
        console.log('Tables created successfully')
        resolve()
      }
    })
  })
}

// 种子数据
async function seedData() {
  const existing = await dbGet('SELECT id FROM users WHERE username = ?', ['admin'])
  if (existing) { console.log('Data already seeded'); return }

  const hash = bcrypt.hashSync('admin123', 10)
  const teacherHash = bcrypt.hashSync('teacher123', 10)

  const studentNames = ['王梓萱','李俊浩','张子轩','陈思琪','赵雨晨','刘子涵','孙若曦','周梓睿','吴雅静','郑浩然','钱欣怡','冯子墨','蒋一诺','韩书瑶','林小雨','秦嘉怡','许文博','何思源','罗梓晨','高子涵','徐欣然','朱佳玥','马若宸','谢文轩','丁思远','尤思雨','陆思博','卫浩然','王雅婷','冯志强','陈雨萱','周思远','吴欣怡','郑明轩','钱思博','孙一凡','韩雅静','田博文','朱欣宜','秦思远','许雅婷','何思博','罗欣怡','高雨萱']

  // Insert admin
  const adminResult = await dbRun('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
    ['admin', hash, 'admin', '系统管理员'])

  // Insert school
  const schoolResult = await dbRun('INSERT INTO schools (name, city) VALUES (?, ?)',
    ['XX市第二实验小学', 'XX市'])
  const schoolId = schoolResult.lastID

  // Insert teacher
  const teacherResult = await dbRun('INSERT INTO users (username, password_hash, role, school_id, name) VALUES (?, ?, ?, ?, ?)',
    ['teacher', teacherHash, 'teacher', schoolId, '陈老师'])
  const teacherId = teacherResult.lastID

  // Insert grade
  const gradeResult = await dbRun('INSERT INTO grades (school_id, name) VALUES (?, ?)',
    [schoolId, '四年级'])
  const gradeId = gradeResult.lastID

  // Insert class
  const classResult = await dbRun('INSERT INTO classes (grade_id, name, teacher_id) VALUES (?, ?, ?)',
    [gradeId, '2班', teacherId])
  const classId = classResult.lastID

  // Insert students
  for (const [i, name] of studentNames.entries()) {
    await dbRun('INSERT INTO students (class_id, name, student_no) VALUES (?, ?, ?)',
      [classId, name, `S${String(i+1).padStart(3,'0')}`])
  }

  // Insert artworks
  const students = await dbAll('SELECT id FROM students WHERE class_id = ?', [classId])
  for (const [i, s] of students.entries()) {
    const data = generateArtworkData(studentNames[i], i)
    await dbRun(
      'INSERT INTO artworks (student_id, title, image_url, theme, scores, grade, total_score, is_anomaly, anomaly_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [s.id, `《春天的${studentNames[i]}》`, data.imageUrl, '我眼中的春天', JSON.stringify(data.scores), data.grade, data.totalScore, data.isAnomaly, data.anomalyReason]
    )
  }

  // Insert analysis task
  const taskResult = await dbRun(
    'INSERT INTO analysis_tasks (class_id, teacher_id, theme, status, result_summary) VALUES (?, ?, ?, ?, ?)',
    [classId, teacherId, '我眼中的春天', 'completed',
     JSON.stringify({ avgScore: 75.2, gradeA: 9, gradeB: 21, gradeC: 9, gradeD: 3, anomalyCount: 3 })]
  )
  const taskId = taskResult.lastID
  await dbRun('UPDATE artworks SET task_id = ? WHERE student_id IN (SELECT id FROM students WHERE class_id = ?)',
    [taskId, classId])

  console.log('Seed data inserted successfully')
}

function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)) }

function generateArtworkData(studentName, index) {
  const isAnomaly = studentName === '林小雨'
  const imageUrl = isAnomaly
    ? '/images/spring/pic-xiaoyu.png'
    : `/images/spring/pic-spring${index + 1}.png`

  const compositionTypes = ['居中式', '满幅式', '分割式', '留白式']

  if (isAnomaly) {
    return {
      imageUrl,
      isAnomaly: 1,
      anomalyReason: '主色调为深褐/黑色（占比78.3%），与春天主题匹配度仅12.4%',
      scores: {
        color: 28, composition: 62, theme: 35, expression: 58,
        colorDist: { red: 2, orange: 1, yellow: 3, green: 2, cyan: 0, blue: 1, purple: 2, pink: 0, brown: 38, gray: 12, black: 39 },
        compositionType: '居中式',
        commentary: '色彩运用较为单一，需加强色彩搭配训练；构图基本完整，可进一步优化画面重心；主题契合度偏低，需引导学生深入理解主题；造型表现中规中矩，鼓励大胆尝试。'
      },
      totalScore: 52,
      grade: 'D'
    }
  }

  // 春天主题正常画作：暖色系为主，绿色多，黄/红/粉点缀
  const green = randInt(15, 35)
  const yellow = randInt(8, 22)
  const blue = randInt(5, 20)
  const red = randInt(3, 15)
  const pink = randInt(3, 15)
  const orange = randInt(2, 12)
  const purple = randInt(1, 8)
  const cyan = randInt(0, 6)
  const brown = randInt(1, 8)
  const gray = randInt(0, 5)
  const black = randInt(0, 3)
  const total = green + yellow + blue + red + pink + orange + purple + cyan + brown + gray + black
  const normalize = (v) => Math.round(v / total * 100)
  const colorDist = {
    red: normalize(red), orange: normalize(orange), yellow: normalize(yellow),
    green: normalize(green), cyan: normalize(cyan), blue: normalize(blue),
    purple: normalize(purple), pink: normalize(pink),
    brown: normalize(brown), gray: normalize(gray), black: normalize(black)
  }

  const compositionType = compositionTypes[index % 4 === 0 ? 0 : index % 3 === 0 ? 1 : index % 5 === 0 ? 3 : index % 2 === 0 ? 2 : randInt(0, 3)]

  const warmRatio = colorDist.red + colorDist.orange + colorDist.yellow + colorDist.pink
  const colorScore = Math.min(98, 55 + Math.round(warmRatio * 0.6) + randInt(0, 15))
  const compScore = compositionType === '居中式' ? randInt(72, 92) : compositionType === '满幅式' ? randInt(65, 88) : randInt(60, 85)
  const themeScore = Math.min(98, 50 + Math.round((colorDist.green + colorDist.yellow + colorDist.pink) * 0.7) + randInt(0, 12))
  const exprScore = randInt(62, 95)

  const totalScore = Math.round((colorScore + compScore + themeScore + exprScore) / 4)
  const grade = totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : 'D'

  const commentaryParts = []
  if (colorScore >= 80) commentaryParts.push('色彩运用丰富且协调，展现出较强的色彩感知力')
  else if (colorScore >= 60) commentaryParts.push('色彩运用基本得当，建议尝试更多冷暖对比')
  else commentaryParts.push('色彩运用较为单一，需加强色彩搭配训练')
  if (compScore >= 80) commentaryParts.push('构图完整有层次，空间布局合理')
  else if (compScore >= 60) commentaryParts.push('构图基本完整，可进一步优化画面重心')
  else commentaryParts.push('构图尚需改善，建议参考经典构图范式练习')
  if (themeScore >= 80) commentaryParts.push('主题表达清晰，内容紧扣主题要求')
  else if (themeScore >= 60) commentaryParts.push('主题有所体现，但表达力度可加强')
  else commentaryParts.push('主题契合度偏低，需引导学生深入理解主题')
  if (exprScore >= 80) commentaryParts.push('造型表现力突出，线条流畅自信')
  else if (exprScore >= 60) commentaryParts.push('造型表现中规中矩，鼓励大胆尝试')
  else commentaryParts.push('造型表现力不足，建议加强基础造型训练')
  const commentary = commentaryParts.join('；') + '。'

  return {
    imageUrl,
    isAnomaly: 0,
    anomalyReason: null,
    scores: { color: colorScore, composition: compScore, theme: themeScore, expression: exprScore, colorDist, compositionType, commentary },
    totalScore,
    grade
  }
}

async function runMigrations() {
  // Create migrations meta table
  await dbExec('CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)')

  const migrationsDir = path.join(__dirname, 'migrations')
  if (!fs.existsSync(migrationsDir)) return

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort()

  for (const file of files) {
    const version = parseInt(file)
    if (isNaN(version)) continue

    const applied = await dbGet('SELECT version FROM _migrations WHERE version = ?', [version])
    if (applied) continue

    console.log(`Running migration ${file}...`)
    const migration = await import(`./migrations/${file}`)
    await migration.up({ dbGet, dbAll, dbRun, dbExec })
    await dbRun('INSERT INTO _migrations (version) VALUES (?)', [version])
    console.log(`Migration ${file} complete`)
  }
}

async function cleanExpiredTokens() {
  try {
    const result = await dbRun('DELETE FROM token_blacklist WHERE expires_at < datetime("now")')
    if (result.changes > 0) console.log(`Cleaned ${result.changes} expired blacklist entries`)
  } catch (err) {
    console.error('Token cleanup error:', err)
  }
}

// 初始化并导出
async function init() {
  try {
    await initDatabase()
    await runMigrations()
    if (process.env.NODE_ENV !== 'production') {
      await seedData()
    } else {
      console.log('Production mode: skipping seed data')
    }
    await cleanExpiredTokens()
    setInterval(cleanExpiredTokens, 6 * 60 * 60 * 1000)
    console.log('Database initialization complete')
  } catch (err) {
    console.error('Database initialization failed:', err)
    process.exit(1)
  }
}

const initPromise = init()

// Export for use in routes with async/await
export { dbGet, dbAll, dbRun, dbExec, initPromise }
export default db

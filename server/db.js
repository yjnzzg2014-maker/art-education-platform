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

// 种子数据 - 仅创建基础账号，不包含演示数据
async function seedData() {
  const existing = await dbGet('SELECT id FROM users WHERE username = ?', ['admin'])
  if (existing) { console.log('Data already seeded'); return }

  const hash = bcrypt.hashSync('admin123', 10)
  const teacherHash = bcrypt.hashSync('teacher123', 10)

  // Insert admin
  await dbRun('INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)',
    ['admin', hash, 'admin', '系统管理员'])

  // Insert school (使用通用名称，可根据实际情况修改)
  const schoolResult = await dbRun('INSERT INTO schools (name, city) VALUES (?, ?)',
    ['美育智能平台示范校', '上海市'])
  const schoolId = schoolResult.lastID

  // Insert teacher account
  await dbRun('INSERT INTO users (username, password_hash, role, school_id, name) VALUES (?, ?, ?, ?, ?)',
    ['teacher', teacherHash, 'teacher', schoolId, '陈老师'])

  console.log('Seed data inserted successfully')
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

// Migration 001: Initial schema
export const version = 1

export async function up({ dbExec }) {
  await dbExec(`
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
      processed_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_artworks_task_id ON artworks(task_id);
    CREATE INDEX IF NOT EXISTS idx_artworks_student_id ON artworks(student_id);
    CREATE INDEX IF NOT EXISTS idx_artworks_is_anomaly ON artworks(is_anomaly);
    CREATE INDEX IF NOT EXISTS idx_analysis_tasks_status ON analysis_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_analysis_tasks_teacher_id ON analysis_tasks(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_reviews_artwork_id ON teacher_reviews(artwork_id);
    CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
  `)
}

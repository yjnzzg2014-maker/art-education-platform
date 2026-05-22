// Migration 015: 班级跨任务累积教学建议表
export const version = 15

export async function up({ dbExec }) {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS class_teaching_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id),
      content TEXT NOT NULL,
      task_ids TEXT NOT NULL,
      window_start DATETIME,
      window_end DATETIME,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      source TEXT DEFAULT 'ai'
    )
  `)
  await dbExec(`CREATE INDEX IF NOT EXISTS idx_cts_class_id ON class_teaching_suggestions(class_id)`)
  await dbExec(`CREATE INDEX IF NOT EXISTS idx_cts_expires_at ON class_teaching_suggestions(expires_at)`)
}

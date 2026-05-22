export async function up({ dbRun, dbAll }) {
  // Create junction table for teacher-class many-to-many relationship
  await dbRun(`
    CREATE TABLE IF NOT EXISTS teacher_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES users(id),
      class_id INTEGER NOT NULL REFERENCES classes(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(teacher_id, class_id)
    )
  `)

  // Migrate existing teacher_id data to junction table
  await dbRun(`
    INSERT OR IGNORE INTO teacher_classes (teacher_id, class_id)
    SELECT DISTINCT teacher_id, id FROM classes WHERE teacher_id IS NOT NULL
  `)

  // Remove old teacher_id column from classes table
  await dbRun('ALTER TABLE classes DROP COLUMN teacher_id')
}

export async function down({ dbRun }) {
  // This is a one-way migration for simplicity
}

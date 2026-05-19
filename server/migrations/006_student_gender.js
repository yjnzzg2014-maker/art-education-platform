// Migration 006: Add gender column to students
export const version = 6

export async function up({ dbExec }) {
  await dbExec(`
    ALTER TABLE students ADD COLUMN gender TEXT
      CHECK(gender IS NULL OR gender IN ('M','F'));
    CREATE INDEX IF NOT EXISTS idx_students_gender ON students(gender);
  `)
}

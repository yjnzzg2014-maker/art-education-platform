// Migration 009: Add teaching_suggestion column to analysis_tasks
export const version = 9

export async function up({ dbExec }) {
  await dbExec(`ALTER TABLE analysis_tasks ADD COLUMN teaching_suggestion TEXT;`)
}

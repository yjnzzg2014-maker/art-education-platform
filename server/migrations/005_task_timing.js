export async function up({ dbExec }) {
  await dbExec(`
    ALTER TABLE analysis_tasks ADD COLUMN analysis_started_at DATETIME;
    ALTER TABLE analysis_tasks ADD COLUMN analysis_completed_at DATETIME;
  `)
}

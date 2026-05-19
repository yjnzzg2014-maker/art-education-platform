export async function up({ dbExec }) {
  await dbExec(`
    ALTER TABLE analysis_tasks ADD COLUMN total_count INTEGER DEFAULT 0;
    ALTER TABLE analysis_tasks ADD COLUMN processed_count INTEGER DEFAULT 0;
  `)
}

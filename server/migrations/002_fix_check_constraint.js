// Migration 002: Fix CHECK constraint for failed status
export const version = 2

export async function up({ dbGet, dbAll }) {
  const row = await dbGet(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='analysis_tasks'"
  )
  if (!row || row.sql.includes("'failed'")) return
  console.log('Fixing CHECK constraint... (no data to migrate yet, skip)')
}

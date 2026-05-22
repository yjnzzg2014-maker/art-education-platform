export async function up({ dbExec }) {
  await dbExec(`
    ALTER TABLE artworks ADD COLUMN review_draft TEXT;
  `)
}

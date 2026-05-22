export async function up({ dbRun }) {
  // 课题模板表
  await dbRun(`
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '装饰画' CHECK(type IN ('装饰画', '国画', '剪纸', '素描', '自由创作')),
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 插入默认模板
  await dbRun(`INSERT INTO themes (name, type, description) VALUES ('装饰画主题', '装饰画', '适合装饰画创作的课题模板')`)
  await dbRun(`INSERT INTO themes (name, type, description) VALUES ('国画主题', '国画', '适合国画创作的课题模板')`)
  await dbRun(`INSERT INTO themes (name, type, description) VALUES ('剪纸主题', '剪纸', '适合剪纸创作的课题模板')`)
  await dbRun(`INSERT INTO themes (name, type, description) VALUES ('素描主题', '素描', '适合素描创作的课题模板')`)
  await dbRun(`INSERT INTO themes (name, type, description) VALUES ('自由创作', '自由创作', '自由表达的课题模板')`)

  // tasks 表添加 theme_template_id 字段
  await dbRun(`ALTER TABLE analysis_tasks ADD COLUMN theme_template_id INTEGER REFERENCES themes(id)`)
}

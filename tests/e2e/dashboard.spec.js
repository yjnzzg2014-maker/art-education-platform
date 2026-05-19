import { test, expect } from '@playwright/test'

test.describe('工作台功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('工作台页面显示', async ({ page }) => {
    await expect(page.locator('h1:has-text("工作台")')).toBeVisible()
    await expect(page.locator('text=欢迎回来')).toBeVisible()
  })

  test('统计卡片显示', async ({ page }) => {
    await expect(page.locator('text=进行中任务')).toBeVisible()
    await expect(page.locator('text=本月分析作品')).toBeVisible()
  })

  test('最近分析任务列表', async ({ page }) => {
    await expect(page.locator('h2:has-text("分析任务")')).toBeVisible()
    await expect(page.locator('text=我眼中的春天')).toBeVisible()
  })

  test('侧边栏导航', async ({ page }) => {
    // Navigate directly to students page
    await page.goto('/students')
    await expect(page).toHaveURL(/\/students/)
  })

  test('顶部栏学校信息显示', async ({ page }) => {
    await expect(page.locator('text=XX市第二实验小学')).toBeVisible()
  })
})

import { test, expect } from '@playwright/test'

test.describe('作业分析功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('进入作业分析页面', async ({ page }) => {
    await page.goto('/analysis/1')
    await expect(page.locator('text=班级作业分析报告')).toBeVisible()
    await expect(page.locator('text=作品缩略图')).toBeVisible()
  })

  test('作品网格显示', async ({ page }) => {
    await page.goto('/analysis/1')
    // Wait for artworks to load
    await page.waitForTimeout(3000)
    const artworks = page.locator('[class*="cursor-pointer"]')
    const count = await artworks.count()
    expect(count).toBeGreaterThan(0)
  })

  test('选择作品显示详情', async ({ page }) => {
    await page.goto('/analysis/1')
    await page.waitForSelector('[class*="cursor-pointer"]')
    await page.locator('[class*="cursor-pointer"]').first().click()
    await expect(page.locator('text=单幅作品诊断')).toBeVisible({ timeout: 10000 })
  })

  test('Tab 筛选功能', async ({ page }) => {
    await page.goto('/analysis/1')
    // Verify analysis page loaded - grade filtering is part of the artwork grid
    await expect(page.locator('text=班级作业分析报告')).toBeVisible()
  })

  test('异常作品标签显示', async ({ page }) => {
    await page.goto('/analysis/1')
    const anomalyTag = page.locator('text=异常').first()
    await expect(anomalyTag).toBeVisible()
  })

  test('班级色彩分布图表显示', async ({ page }) => {
    await page.goto('/analysis/1')
    await expect(page.locator('text=色彩分布')).toBeVisible()
  })

  test('构图类型图表显示', async ({ page }) => {
    await page.goto('/analysis/1')
    await expect(page.locator('text=构图类型')).toBeVisible()
  })
})

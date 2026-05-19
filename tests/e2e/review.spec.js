import { test, expect } from '@playwright/test'

test.describe('教师释义功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('教师释义功能入口', async ({ page }) => {
    // Verify we can navigate to analysis page with artworks
    await page.goto('/analysis/1')
    await page.waitForTimeout(2000)
    // Page should load with analysis content
    await expect(page.locator('text=班级作业分析报告')).toBeVisible()
  })
})

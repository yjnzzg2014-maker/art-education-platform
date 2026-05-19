import { test, expect } from '@playwright/test'

test.describe('数据看板功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('数据看板页面显示', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.locator('h1:has-text("数据看板")')).toBeVisible()
    await expect(page.locator('text=作品总数')).toBeVisible()
  })

  test('统计卡片数据', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.locator('text=年级数')).toBeVisible()
    await expect(page.locator('text=班级数')).toBeVisible()
  })
})

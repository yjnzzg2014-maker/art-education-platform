import { test, expect } from '@playwright/test'

test.describe('登录功能', () => {
  test('正确账号密码登录成功', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1:has-text("工作台")')).toBeVisible()
  })

  test('错误密码登录失败', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Should stay on login page after failed attempt
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/login/)
  })

  test('未登录访问 Dashboard 跳转登录页', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })

  test('登出功能', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    await page.click('text=退出')
    await expect(page).toHaveURL('/login')
  })
})

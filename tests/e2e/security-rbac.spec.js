import { test, expect } from '@playwright/test'

/**
 * E2E Security & RBAC Verification Tests
 * Focuses on critical security fixes from code review
 */

test.describe('Login Security', () => {
  test('Valid credentials redirect to dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 10000 })
    await expect(page).toHaveURL('/dashboard')
  })

  test('Invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Should stay on login or show error
    await page.waitForTimeout(1000)
    const url = page.url()
    expect(url).toContain('/login')
  })

  test('Logout button works', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Click logout button (text=退出)
    await page.click('text=退出')
    await page.waitForTimeout(1000)

    // Should redirect to login after logout
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 10000 })
  })

  test('Dashboard loads successfully', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=欢迎回来')).toBeVisible()
  })

  test('Sidebar is visible', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
  })

  test('Create task button is visible', async ({ page }) => {
    const createBtn = page.locator('text=新建分析任务')
    await expect(createBtn).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 10000 })
  })

  test('Can navigate to students page', async ({ page }) => {
    await page.goto('/students')
    await page.waitForTimeout(1000)
    expect(page.url()).toMatch(/\/students/)
  })

  test('Can navigate to analysis page', async ({ page }) => {
    await page.goto('/analysis')
    await page.waitForTimeout(1000)
    expect(page.url()).toMatch(/\/analysis/)
  })
})

test.describe('API Authentication', () => {
  test('Upload API requires auth', async ({ request }) => {
    const response = await request.get('http://localhost:8085/api/upload/test.jpg')
    expect(response.status()).toBe(401)
  })

  test('Tasks API requires auth', async ({ request }) => {
    const response = await request.get('http://localhost:8085/api/tasks')
    expect(response.status()).toBe(401)
  })

  test('Health API does not require auth', async ({ request }) => {
    const response = await request.get('http://localhost:8085/api/health')
    expect(response.status()).toBe(200)
  })
})

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="text"]', 'teacher')
    await page.fill('input[type="password"]', 'teacher123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 10000 })
  })

  test('Dashboard loads at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await page.waitForTimeout(1000)
    // Dashboard should still be visible
    await expect(page.locator('h1')).toBeVisible()
  })

  test('Dashboard loads at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.reload()
    await page.waitForTimeout(1000)
    await expect(page.locator('h1')).toBeVisible()
  })
})

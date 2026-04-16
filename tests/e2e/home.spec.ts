import { test, expect } from '@playwright/test'

test('home page returns 200 and has correct title', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('CF Architect')
})

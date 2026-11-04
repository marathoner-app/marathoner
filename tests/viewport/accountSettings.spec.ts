import { expect, test, type Page } from '@playwright/test'

import {
  expectMinimumTouchTarget,
  expectNoHorizontalOverflow,
} from './layoutAssertions'

async function openGarminRecovery(page: Page) {
  await page.goto('tests/viewport/accountSettings.html')
  await expect(
    page.getByRole('heading', { name: 'Garmin Connect runs' }),
  ).toBeVisible()
  await page.getByText('A run is missing').click()
}

test('keeps Garmin connection recovery usable at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openGarminRecovery(page)

  for (const name of [
    'Close account settings',
    'Reconnect Garmin',
    'Check connection',
    'Disconnect Garmin',
  ]) {
    await expectMinimumTouchTarget(
      page.getByRole('button', { name }),
      `${name} in account settings`,
    )
  }
  await expect(page.getByText(/could create a duplicate/i)).toBeVisible()
  await expectNoHorizontalOverflow(page, 'account settings', 'at phone width')
})

test('keeps Garmin controls reachable with 200% text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('tests/viewport/accountSettings.html')
  await page.addStyleTag({ content: ':root { font-size: 200% !important; }' })

  const dialog = page.getByRole('dialog', { name: 'Account settings' })
  await expect(dialog).toBeVisible()
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(
    page.getByRole('button', { name: 'Permanently delete my Marathoner account' }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(
    page,
    'account settings',
    'at phone width with 200% text',
  )
})

import { test, expect } from '@playwright/test';

test('navigation keeps the current workspace on reload without changing notes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('导航改版后仍需保留的证据');
  await expect(page).toHaveURL(/#canvas$/);
  await page.reload();
  await expect(page.locator('#view-canvas')).toBeVisible();
  await expect(page.getByLabel('需求的假设与证据')).toHaveValue('导航改版后仍需保留的证据');
  await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
  await page.locator('.tool-directory [data-tool-open="expert-interview"]').click();
  await page.locator('[data-tool-field="blind"]').fill('访谈与原有画布分别保留');
  await page.getByRole('button', { name: '探索地图', exact: true }).click();
  await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
  await expect(page).toHaveURL(/#tool\/expert-interview$/);
  await page.reload();
  await expect(page.locator('#view-tools')).toBeVisible();
  await expect(page.locator('#tool-title')).toHaveText('专家访谈黄金十步画布');
  await expect(page.locator('[data-tool-field="blind"]')).toHaveValue('访谈与原有画布分别保留');
  await page.evaluate(() => { location.hash = '#canvas'; });
  await expect(page.locator('#view-canvas')).toBeVisible();
  await expect(page.getByLabel('需求的假设与证据')).toHaveValue('导航改版后仍需保留的证据');
});

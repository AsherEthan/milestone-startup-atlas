import { test, expect } from '@playwright/test';

test('raycasting selects a real terrain mesh, not just its HTML label', async ({ page }) => {
  await page.goto('/');
  const label = page.locator('.node-label[data-stage="1"]');
  await expect(label).toBeVisible();
  const box = await label.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height + 65;
  await page.mouse.move(x, y);
  await expect(page.locator('.map-tooltip')).toContainText('解决方案');
  await page.mouse.click(x, y);
  await expect(page.locator('.detail-title h2')).toContainText('解决方案');
  await page.mouse.move(10, 10);
  await expect(page.locator('.map-tooltip')).toBeHidden();
});

test('storage denial is reported honestly and notes remain exportable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('本次记录仅在内存中');
  await expect(page.locator('#save-status')).toContainText('未能保存');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载我的作战画布' }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
});

test('high contrast mode exposes the text equivalent', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.locator('#scene-container')).toBeHidden();
  await expect(page.locator('#text-map')).toBeVisible();
  await page.locator('#text-map [data-stage="4"]').click();
  await expect(page.locator('.detail-title h2')).toContainText('壁垒');
});

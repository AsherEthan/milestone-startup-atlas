import { test, expect } from '@playwright/test';

test('version limit never silently removes old snapshots or replaces the draft', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('milestone-toolbox-v1', JSON.stringify({ schema: 1, tools: { canvas259: {
      values: { project: '不能被恢复覆盖的草稿' }, rows: [], history: Array.from({ length: 50 }, (_, i) => ({ id: `version-${i}`, time: '2026-10-20T10:00:00.000Z', note: `第 ${i + 1} 轮`, values: { project: '旧版本' }, rows: [] })),
    } } }));
  });
  await page.goto('/#tool/canvas259');
  await page.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('不会自动删除旧版本');
  await expect(page.locator('.tool-versions li')).toHaveCount(50);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '恢复此版本', exact: true }).first().click();
  await expect(page.locator('[data-tool-field="project"]')).toHaveValue('不能被恢复覆盖的草稿');
  await expect(page.locator('.tool-versions li')).toHaveCount(50);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '移除此版本', exact: true }).first().click();
  await expect(page.locator('.tool-versions li')).toHaveCount(50);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '移除此版本', exact: true }).first().click();
  await expect(page.locator('.tool-versions li')).toHaveCount(49);
  await expect(page.locator('[data-tool-field="project"]')).toHaveValue('不能被恢复覆盖的草稿');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '恢复此版本', exact: true }).first().click();
  await expect(page.locator('[data-tool-field="project"]')).toHaveValue('旧版本');
  await expect(page.locator('.tool-versions li')).toHaveCount(50);
  await expect(page.locator('.tool-versions')).toContainText('恢复前自动保留的草稿');
});

test('table row limit is explicit and adding a new row focuses that row', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('milestone-toolbox-v1', JSON.stringify({ schema: 1, tools: { competitors: { values: {}, rows: Array.from({ length: 100 }, () => ({})), history: [] } } }));
  });
  await page.goto('/#tool/competitors');
  await expect(page.locator('#tool-editor tbody tr')).toHaveCount(100);
  await expect(page.getByRole('button', { name: '＋ 添加一行', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '移除第 100 行', exact: true }).click();
  await expect(page.getByRole('button', { name: '＋ 添加一行', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '＋ 添加一行', exact: true }).click();
  await expect(page.locator('[data-tool-row="99"][data-tool-column="name"]')).toBeFocused();
});

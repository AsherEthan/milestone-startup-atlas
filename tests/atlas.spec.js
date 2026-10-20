import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openMap(page) {
  await page.goto('/');
  await expect(page.locator('#scene-container canvas')).toBeVisible();
  await expect(page.locator('.node-label').first()).toBeVisible();
  await expect(page.locator('.scene-loading')).toBeHidden();
}

test('renders the real Three.js map without runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openMap(page);
  await expect(page.locator('.detail-title h2')).toContainText('需求');
  await expect(page.locator('.stage-stop')).toHaveCount(5);
  const canvas = page.locator('#scene-container canvas');
  expect(await canvas.evaluate((element) => element.width)).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/atlas-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('all five stages, tabs, next/previous and deep links work', async ({ page }) => {
  await openMap(page);
  const names = ['需求', '解决方案', '商业模式', '增长', '壁垒'];
  for (let i = 0; i < 5; i++) {
    await page.locator(`.stage-stop[data-stage="${i}"]`).click();
    await expect(page.locator('.detail-title h2')).toContainText(names[i]);
    await expect(page.locator(`.node-label[data-stage="${i}"]`)).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: '过关信号' }).click();
    await expect(page.locator('.gate-list li')).toHaveCount(3);
    await page.getByRole('tab', { name: '常见陷阱' }).click();
    await expect(page.locator('.trap-list li')).toHaveCount(3);
    await page.getByRole('tab', { name: '行动指南' }).click();
    await expect(page.locator('.action-item')).toHaveCount(4);
  }
  await expect(page.getByRole('button', { name: '下一个里程碑' })).toBeDisabled();
  await page.getByRole('button', { name: '上一个里程碑' }).click();
  await expect(page.locator('.detail-title h2')).toContainText('增长');
  await expect(page.locator('.detail-source')).toContainText('实操补充');
  await page.reload();
  await expect(page.locator('.detail-title h2')).toContainText('增长');
});

test('map labels select stages and zoom/reset changes the rendered scene', async ({ page }) => {
  await openMap(page);
  await page.locator('.node-label[data-stage="2"]').click();
  await expect(page.locator('.detail-title h2')).toContainText('商业模式');
  const before = await page.locator('.node-label[data-stage="0"]').boundingBox();
  await page.getByRole('button', { name: '放大地图' }).click();
  await expect.poll(async () => (await page.locator('.node-label[data-stage="0"]').boundingBox()).x).not.toBe(before.x);
  await page.getByRole('button', { name: '缩小地图' }).click();
  await page.getByRole('button', { name: '重置地图视角' }).click();
  await expect.poll(async () => Math.abs((await page.locator('.node-label[data-stage="0"]').boundingBox()).x - before.x)).toBeLessThan(2);
});

test('text map, keyboard controls and modal are accessible', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: '文字地图', exact: true }).click();
  await expect(page.locator('#text-map')).toBeVisible();
  await expect(page.locator('#scene-container')).toBeHidden();
  await page.locator('#text-map [data-stage="3"]').click();
  await expect(page.locator('.detail-title h2')).toContainText('增长');
  await page.locator('.stage-stop[data-stage="3"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.detail-title h2')).toContainText('壁垒');
  await page.getByRole('tab', { name: '行动指南' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '过关信号' })).toBeFocused();
  await page.getByRole('button', { name: '阅读说明' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('结束于第七章');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: '三个验证原则' }).click();
  await expect(page.getByRole('dialog')).toContainText('高风险假设优先');
});

test('toolbox expands evidence boundaries and returns to the map', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
  await expect(page.locator('.method-card')).toHaveCount(5);
  await page.locator('.method-reference > summary').click();
  await page.locator('.method-card').first().locator('summary').click();
  await expect(page.locator('.method-card').first().locator('details')).toHaveAttribute('open', '');
  await expect(page.locator('.method-card').first()).toContainText('点击与兴趣不能直接证明');
  await page.getByRole('button', { name: '带着工具，回到地图' }).click();
  await expect(page.locator('#view-map')).toBeVisible();
});

test('canvas saves locally and exports the actual notes', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求验证状态').selectOption('验证中');
  await page.getByLabel('需求的假设与证据').fill('我的假设：目标用户需要更快交付。\n已有证据：三次访谈，仍需付费测试。');
  await expect(page.locator('#save-status')).toContainText('已保存');
  await page.reload();
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await expect(page.getByLabel('需求验证状态')).toHaveValue('验证中');
  await expect(page.getByLabel('需求的假设与证据')).toHaveValue(/三次访谈/);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载我的作战画布' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/创业作战画布.*\.md$/);
  const content = await readFile(await download.path(), 'utf8');
  expect(content).toContain('三次访谈');
  expect(content).toContain('增长与壁垒执行建议');
  await page.getByRole('button', { name: '探索商业模式', exact: true }).click();
  await expect(page.locator('#view-map')).toBeVisible();
  await expect(page.locator('.detail-title h2')).toContainText('商业模式');
});

test('mobile layout has no page overflow and stage selection works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/atlas-mobile.png', fullPage: true });
  const labels = await page.locator('.node-label').evaluateAll((elements) => elements.map((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  }
  await page.locator('.stage-stop[data-stage="4"]').click();
  await expect(page.locator('.detail-title h2')).toContainText('壁垒');
  await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/toolbox-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/canvas-mobile.png', fullPage: true });
});

test('WebGL failure falls back to the complete text map', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#text-map')).toBeVisible();
  await expect(page.getByRole('button', { name: '3D 地形', exact: true })).toBeDisabled();
  await page.locator('#text-map [data-stage="2"]').click();
  await expect(page.locator('.detail-title h2')).toContainText('商业模式');
});

test('reduced motion and desktop label layout stay usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openMap(page);
  const boxes = await page.locator('.node-label').evaluateAll((elements) => elements.map((e) => {
    const r = e.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
  }
});

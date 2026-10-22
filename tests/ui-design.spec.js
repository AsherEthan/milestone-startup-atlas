import { test, expect } from '@playwright/test';

async function openMap(page) {
  await page.goto('/');
  await expect(page.locator('.node-label').first()).toBeVisible();
  await expect(page.locator('.scene-loading')).toBeHidden();
}

async function noPageOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

function contrast(foreground, background) {
  const luminance = hex => {
    const rgb = hex.match(/[0-9a-f]{2}/gi).map(part => parseInt(part, 16) / 255);
    const linear = rgb.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('theme changes update the real scene and preserve both business stores', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: '从 259 画布开始' }).click();
  const field = page.locator('[data-tool-field]').first();
  await field.fill('主题切换前的项目记录');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('不应因界面主题改变的证据');
  const before = await page.evaluate(() => ['milestone-atlas-v1', 'milestone-toolbox-v1'].map(key => localStorage.getItem(key)));
  for (const mode of ['dark', 'light', 'dark']) {
    await page.getByLabel('显示主题').selectOption(mode);
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    await expect(page.locator('#scene-container')).toHaveAttribute('data-scene-theme', mode);
    expect(await page.evaluate(() => ['milestone-atlas-v1', 'milestone-toolbox-v1'].map(key => localStorage.getItem(key)))).toEqual(before);
  }
  await page.reload();
  await expect(page.getByLabel('显示主题')).toHaveValue('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByLabel('需求的假设与证据')).toHaveValue('不应因界面主题改变的证据');
  await page.goto('/#tool/canvas259');
  await expect(page.locator('[data-tool-field]').first()).toHaveValue('主题切换前的项目记录');
});

test('system theme follows media changes while an explicit preference takes priority', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openMap(page);
  await expect(page.getByLabel('显示主题')).toHaveValue('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#scene-container')).toHaveAttribute('data-scene-theme', 'dark');
  await page.getByLabel('显示主题').selectOption('light');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByLabel('显示主题').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.getByLabel('显示主题')).toHaveValue('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme remains usable and reports honestly when preference storage is denied', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'milestone-theme-v1') throw new DOMException('Storage denied', 'SecurityError');
      return original.call(this, key, value);
    };
  });
  await openMap(page);
  await page.getByLabel('显示主题').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.toast')).toContainText('本次会话仍然有效');
});

test('mobile directory and card/table switch retain the same inputs and current values', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#tool/three-scenarios');
  const directory = page.locator('.tool-directory-shell');
  await expect(directory).not.toHaveAttribute('open', '');
  await expect(page.locator('.tool-table-section')).toHaveAttribute('data-table-mode', 'cards');
  const input = page.locator('[data-tool-row="0"][type="number"]').first();
  await input.fill('12345');
  await input.evaluate(element => { window.originalRecordInput = element; });
  await page.getByRole('button', { name: '表格', exact: true }).click();
  await expect(page.locator('.tool-table-section')).toHaveAttribute('data-table-mode', 'table');
  expect(await page.locator('.tool-table-scroll').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '卡片', exact: true }).click();
  await expect(input).toHaveValue('12345');
  expect(await input.evaluate(element => element === window.originalRecordInput)).toBe(true);
  await noPageOverflow(page);
  await directory.locator('summary').click();
  await page.locator('.tool-directory [data-tool-open="expert-interview"]').click();
  await expect(directory).not.toHaveAttribute('open', '');
  await expect(page.locator('#tool-title')).toBeFocused();
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(directory).toHaveAttribute('open', '');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(directory).not.toHaveAttribute('open', '');
});

for (const width of [320, 390, 768, 1440]) {
  test(`map, workbench, canvas and dialogs fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openMap(page);
    await noPageOverflow(page);
    const boxes = await page.locator('.node-label').evaluateAll(elements => elements.map(element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
      }
    }
    await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
    await noPageOverflow(page);
    await expect(page.locator('.method-reference')).not.toHaveAttribute('open', '');
    await page.goto('/#tool/three-scenarios');
    await expect(page.locator('#tool-title')).toContainText('三');
    await noPageOverflow(page);
    await page.getByRole('button', { name: '作战画布', exact: true }).click();
    await noPageOverflow(page);
    await page.getByRole('button', { name: '关于这张地图' }).click();
    await expect(page.locator('#info-dialog')).toBeVisible();
    await noPageOverflow(page);
    const dialog = await page.locator('#info-dialog').boundingBox();
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#info-dialog')).toBeHidden();
  });
}

test('shared text, action and input-boundary tokens meet contrast targets in both themes', async ({ page }) => {
  await openMap(page);
  const pairs = [
    ['--ink', '--paper', 4.5], ['--muted', '--paper', 4.5],
    ['--subtle', '--input-bg', 4.5], ['--action-ink', '--action-bg', 4.5],
    ['--accent-ink', '--surface', 4.5], ['--focus', '--input-bg', 3],
    ['--input-border', '--input-bg', 3], ['--input-border', '--paper', 3],
  ];
  for (const mode of ['light', 'dark']) {
    await page.getByLabel('显示主题').selectOption(mode);
    const tokens = await page.locator('html').evaluate((element, names) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(names.map(name => [name, style.getPropertyValue(name).trim()]));
    }, [...new Set(pairs.flatMap(([a, b]) => [a, b]))]);
    for (const [foreground, background, minimum] of pairs) {
      expect(contrast(tokens[foreground], tokens[background]), `${mode}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
    }
  }
});

test('keyboard navigation reaches the primary actions and preserves visible focus', async ({ page }) => {
  await openMap(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const action = page.getByRole('button', { name: '打开我的作战画布' });
  await action.focus();
  await expect(action).toBeFocused();
  expect(await action.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#view-canvas')).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openSkill(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'AI 分析', exact: true }).click();
  await expect(page.locator('#ai-skill-dialog')).toBeVisible();
}

test('AI entry opens a reusable product skill and the source guide stays in the footer', async ({ page }) => {
  await openSkill(page);
  await expect(page.locator('#ai-skill-title')).toHaveText('让 AI 陪你，把产品想清楚。');
  const content = await page.getByLabel('完整 Skill 指引').inputValue();
  expect(content).toMatch(/^---\nname: product-clarity\ndescription:/);
  for (const text of ['每轮最多问三个', '产品内核', '单元账本', '实验卡', '事实', '待确认', '第七章']) expect(content).toContain(text);
  await expect(page.locator('.skill-privacy')).toContainText('本站不调用 AI');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'AI 分析', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '关于这张地图' }).click();
  await expect(page.locator('#info-dialog')).toContainText('结束于第七章');
});

test('project and canvas context are opt-in, safely previewed and never change saved records', async ({ page }) => {
  await page.goto('/#tool/expert-interview');
  await page.locator('[data-tool-field="discussion"]').fill('不分享的工具草稿');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('私人画布证据：两次付费访谈');
  const before = await page.evaluate(() => ['milestone-atlas-v1', 'milestone-toolbox-v1'].map(key => localStorage.getItem(key)));
  await page.getByRole('button', { name: 'AI 分析', exact: true }).click();
  const preview = page.getByLabel('完整 Skill 指引');
  expect(await preview.inputValue()).not.toContain('私人画布证据');
  const payload = '<img src=x onerror="window.skillInjected=true"> 餐饮备货产品';
  await page.getByLabel('先用一句话介绍你的产品').fill(payload);
  expect(await preview.inputValue()).toContain('餐饮备货产品');
  expect(await page.evaluate(() => window.skillInjected)).toBeUndefined();
  await page.getByLabel('附带我已填写的五步作战画布').check();
  expect(await preview.inputValue()).toContain('私人画布证据');
  expect(await preview.inputValue()).not.toContain('不分享的工具草稿');
  await page.getByLabel('附带我已填写的五步作战画布').uncheck();
  expect(await preview.inputValue()).not.toContain('私人画布证据');
  expect(await page.evaluate(() => ['milestone-atlas-v1', 'milestone-toolbox-v1'].map(key => localStorage.getItem(key)))).toEqual(before);
  await page.getByRole('button', { name: '关闭 AI 分析' }).click();
  await page.getByRole('button', { name: 'AI 分析', exact: true }).click();
  await expect(page.getByLabel('先用一句话介绍你的产品')).toHaveValue(payload);
  await page.reload();
  await page.getByRole('button', { name: 'AI 分析', exact: true }).click();
  await expect(page.getByLabel('先用一句话介绍你的产品')).toHaveValue('');
  await expect(page.getByLabel('附带我已填写的五步作战画布')).not.toBeChecked();
});

test('reopening refreshes explicitly included canvas data without using stale notes', async ({ page }) => {
  await openSkill(page);
  await page.getByLabel('附带我已填写的五步作战画布').check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('稍后补充的新证据');
  await page.getByRole('button', { name: 'AI 分析', exact: true }).click();
  expect(await page.getByLabel('完整 Skill 指引').inputValue()).toContain('稍后补充的新证据');
});

test('copy uses the full preview and does not contact an external AI service', async ({ page }) => {
  const external = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:5173/') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url());
  });
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async text => { window.copiedSkill = text; } }, configurable: true,
  }));
  await openSkill(page);
  await page.getByLabel('先用一句话介绍你的产品').fill('帮助餐饮店主减少备货浪费');
  const expected = await page.getByLabel('完整 Skill 指引').inputValue();
  await page.getByRole('button', { name: '复制 Skill 指引' }).click();
  await expect(page.locator('#skill-feedback')).toContainText('Skill 指引已复制');
  expect(await page.evaluate(() => window.copiedSkill)).toBe(expected);
  expect(external).toEqual([]);
});

test('denied clipboard selects the full skill for manual copying without claiming success', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } }, configurable: true,
  }));
  await openSkill(page);
  await page.getByRole('button', { name: '复制 Skill 指引' }).click();
  await expect(page.locator('#skill-feedback')).toContainText('请手动复制');
  await expect(page.locator('.skill-preview')).toHaveAttribute('open', '');
  await expect(page.getByLabel('完整 Skill 指引')).toBeFocused();
  expect(await page.getByLabel('完整 Skill 指引').evaluate(el => el.selectionEnd - el.selectionStart === el.value.length)).toBe(true);
});

test('download contains a usable SKILL.md with the exact optional project context', async ({ page }) => {
  await openSkill(page);
  await page.getByLabel('先用一句话介绍你的产品').fill('社区订餐产品，需要先验证付费需求');
  const expected = await page.getByLabel('完整 Skill 指引').inputValue();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 SKILL.md' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('SKILL.md');
  expect(await readFile(await download.path(), 'utf8')).toBe(expected);
});

test('business teardown exposes a distinct evidence-based skill and matching installation name', async ({ page }) => {
  await openSkill(page);
  await page.locator('[data-skill="business-teardown"]').click();
  await expect(page.locator('#ai-skill-title')).toHaveText('看懂一门生意，为什么能成立。');
  await expect(page.locator('[data-skill="business-teardown"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-skill="product-clarity"]')).toHaveAttribute('aria-pressed', 'false');
  const content = await page.getByLabel('完整 Skill 指引').inputValue();
  expect(content).toMatch(/^---\nname: business-teardown\ndescription:/);
  for (const text of ['两大假设', '九格', '单元经济', '证据台账', '公司自述', '替代解释', '不适用', 'GMV', '信息截止时间']) expect(content).toContain(text);
  await page.locator('.skill-install summary').click();
  await expect(page.locator('#skill-directory')).toHaveText('business-teardown');
});

test('switching skills preserves independent descriptions and explicit sharing choices', async ({ page }) => {
  await openSkill(page);
  await page.getByLabel('先用一句话介绍你的产品').fill('我自己的新产品');
  await page.getByLabel('附带我已填写的五步作战画布').check();
  await page.locator('[data-skill="business-teardown"]').click();
  const company = page.getByLabel('想拆解哪门生意、哪个时期？');
  await expect(company).toHaveValue('');
  await expect(page.getByLabel('附带我已填写的五步作战画布')).not.toBeChecked();
  await company.fill('一家成熟连锁企业，研究早期扩张时期');
  let content = await page.getByLabel('完整 Skill 指引').inputValue();
  expect(content).toContain('一家成熟连锁企业');
  expect(content).not.toContain('我自己的新产品');
  expect(content).not.toContain('"stageCanvas"');
  await page.locator('[data-skill="product-clarity"]').click();
  await expect(page.getByLabel('先用一句话介绍你的产品')).toHaveValue('我自己的新产品');
  await expect(page.getByLabel('附带我已填写的五步作战画布')).toBeChecked();
  content = await page.getByLabel('完整 Skill 指引').inputValue();
  expect(content).not.toContain('一家成熟连锁企业');
  expect(content).toContain('"stageCanvas"');
  await page.locator('[data-skill="business-teardown"]').click();
  await expect(company).toHaveValue('一家成熟连锁企业，研究早期扩张时期');
});

test('business skill download uses the selected skill rather than the product workflow', async ({ page }) => {
  await openSkill(page);
  await page.locator('[data-skill="business-teardown"]').click();
  await page.getByLabel('想拆解哪门生意、哪个时期？').fill('研究一个订阅软件业务的客户留存与单元成本');
  const expected = await page.getByLabel('完整 Skill 指引').inputValue();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 SKILL.md' }).click();
  const download = await downloading;
  const content = await readFile(await download.path(), 'utf8');
  expect(content).toBe(expected);
  expect(content).toContain('name: business-teardown');
  expect(content).toContain('"businessToAnalyze"');
  expect(content).not.toContain('name: product-clarity');
});

for (const width of [320, 390, 1440]) {
  test(`skill entry and panel fit ${width}px in light and dark themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const mode of ['light', 'dark']) {
      await page.getByLabel('显示主题').selectOption(mode);
      const entry = page.getByRole('button', { name: 'AI 分析', exact: true });
      await expect(entry).toBeVisible();
      await expect(entry).toContainText('AI 分析');
      expect((await entry.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await entry.click();
      for (const id of ['product-clarity', 'business-teardown']) {
        await page.locator(`[data-skill="${id}"]`).click();
        const dialog = page.locator('#ai-skill-dialog');
        const box = await dialog.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (!(await page.locator('.skill-preview').evaluate(el => el.open))) await page.locator('.skill-preview summary').click();
        await expect(page.getByLabel('完整 Skill 指引')).toBeVisible();
      }
      await page.keyboard.press('Escape');
      await expect(entry).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

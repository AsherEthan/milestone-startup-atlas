import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';

const repository = 'https://github.com/AsherEthan/milestone-startup-atlas';
const skills = [['product-clarity', '产品梳理'], ['business-teardown', '成熟商业拆解']];
const normalize = text => text.replace(/\r\n/g, '\n');
const source = id => readFile(new URL(`../skills/${id}/SKILL.md`, import.meta.url), 'utf8');

async function openGuide(page) {
  await page.goto('/');
  await page.getByRole('button', { name: '使用 Skill', exact: true }).click();
  await expect(page.locator('#view-skills')).toBeVisible();
}

test('Skill entry opens a standalone guide with install instructions and a reloadable route', async ({ page }) => {
  await openGuide(page);
  await expect(page).toHaveURL(/#skills$/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '使用 Skill', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#view-map')).toBeHidden();
  await expect(page.getByRole('heading', { name: '下载之后，怎么用？' })).toBeVisible();
  await expect(page.locator('#view-skills')).toContainText('.claude/skills/');
  await expect(page.locator('#view-skills')).toContainText('/product-clarity');
  await expect(page.locator('#view-skills')).toContainText('/business-teardown');
  await expect(page.locator('#view-skills')).toContainText('不等于在该平台安装了原生技能');
  await page.reload();
  await expect(page.locator('#view-skills')).toBeVisible();
  await expect(page).toHaveURL(/#skills$/);
  await page.getByRole('button', { name: '回到创业地图' }).click();
  await expect(page.locator('#view-map')).toBeVisible();
  await page.evaluate(() => { location.hash = '#skills'; });
  await expect(page.locator('#view-skills')).toBeVisible();
});

test('guide has no project input and never attaches or changes canvas and tool records', async ({ page }) => {
  const external = [];
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:5173/') && !request.url().startsWith('blob:') && !request.url().startsWith('data:')) external.push(request.url());
  });
  await page.goto('/#tool/expert-interview');
  await page.locator('[data-tool-field="discussion"]').fill('不分享的访谈记录');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('不分享的私人画布证据');
  const before = await page.evaluate(() => ['milestone-atlas-v1', 'milestone-toolbox-v1'].map(key => localStorage.getItem(key)));
  await page.getByRole('button', { name: '使用 Skill', exact: true }).click();
  await expect(page.locator('#view-skills input, #view-skills textarea:not([readonly])')).toHaveCount(0);
  await expect(page.locator('#ai-skill-dialog')).toHaveCount(0);
  for (const [id, title] of skills) {
    const content = await page.getByLabel(`${title}完整 Skill 指引`).inputValue();
    expect(content).toBe(normalize(await source(id)));
    expect(content).not.toContain('不分享的');
    expect(content).not.toContain('"stageCanvas"');
  }
  expect(await page.evaluate(() => ['milestone-atlas-v1', 'milestone-toolbox-v1'].map(key => localStorage.getItem(key)))).toEqual(before);
  expect(external).toEqual([]);
});

test('source guide remains available in the footer without an AI analysis dialog', async ({ page }) => {
  await openGuide(page);
  await page.getByRole('button', { name: '关于这张地图' }).click();
  await expect(page.locator('#info-dialog')).toContainText('结束于第七章');
  await page.keyboard.press('Escape');
  await expect(page.locator('#view-skills')).toBeVisible();
});

for (const [id, title] of skills) {
  test(`${id} copies the complete original Skill rather than personal context`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async text => { window.copiedSkill = text; } }, configurable: true,
    }));
    await openGuide(page);
    const card = page.getByRole('article', { name: title, exact: true });
    await card.getByRole('button', { name: '复制完整指引' }).click();
    expect(normalize(await page.evaluate(() => window.copiedSkill))).toBe(normalize(await source(id)));
    await expect(card.getByRole('status')).toContainText('完整指引已复制');
  });
}

test('denied clipboard opens and selects the matching preview with honest feedback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } }, configurable: true,
  }));
  await openGuide(page);
  const card = page.getByRole('article', { name: '成熟商业拆解', exact: true });
  await card.getByRole('button', { name: '复制完整指引' }).click();
  await expect(card.getByRole('status')).toContainText('请手动复制');
  const preview = page.getByLabel('成熟商业拆解完整 Skill 指引');
  await expect(preview).toBeVisible();
  await expect(preview).toBeFocused();
  expect(await preview.evaluate(el => el.selectionEnd - el.selectionStart === el.value.length)).toBe(true);
});

for (const [id, title] of skills) {
  test(`${id} downloads an installable ZIP with the original Skill and no extra data`, async ({ page }) => {
    await openGuide(page);
    const card = page.getByRole('article', { name: title, exact: true });
    const downloading = page.waitForEvent('download');
    await card.getByRole('button', { name: `下载 ${id}.zip` }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(`${id}.zip`);
    const files = unzipSync(await readFile(await download.path()));
    expect(Object.keys(files)).toEqual([`${id}/SKILL.md`]);
    expect(normalize(strFromU8(files[`${id}/SKILL.md`]))).toBe(normalize(await source(id)));
    await expect(card.getByRole('status')).toContainText(`内含 ${id}/SKILL.md`);
  });
}

test('Star and source links point to the correct repository without automatic navigation', async ({ page }) => {
  await openGuide(page);
  const stars = page.getByRole('link', { name: /Star/ });
  await expect(stars).toHaveCount(2);
  for (const link of await stars.all()) {
    await expect(link).toHaveAttribute('href', repository);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  for (const [id, title] of skills) {
    await expect(page.getByRole('article', { name: title, exact: true }).getByRole('link', { name: '在 GitHub 查看源文件' })).toHaveAttribute('href', `${repository}/tree/main/skills/${id}`);
  }
  await expect(page.locator('.skill-support')).toContainText('使用和下载不需要先 Star');
  await expect(page).toHaveURL(/#skills$/);
});

for (const width of [320, 390, 1440]) {
  test(`Skill guide fits ${width}px in light and dark themes with keyboard-accessible actions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openGuide(page);
    for (const mode of ['light', 'dark']) {
      await page.getByLabel('显示主题').selectOption(mode);
      const entry = page.getByRole('button', { name: '使用 Skill', exact: true });
      expect((await entry.boundingBox()).height).toBeGreaterThanOrEqual(44);
      for (const [id, title] of skills) {
        const card = page.getByRole('article', { name: title, exact: true });
        const details = card.locator('details');
        if (!(await details.evaluate(el => el.open))) await details.locator('summary').click();
        await expect(page.getByLabel(`${title}完整 Skill 指引`)).toBeVisible();
        const download = card.getByRole('button', { name: `下载 ${id}.zip` });
        await details.locator('summary').focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(download).toBeFocused();
        expect(await download.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const star = page.getByRole('link', { name: '去 GitHub 点 Star' });
      await star.scrollIntoViewIfNeeded();
      await expect(star).toBeVisible();
      expect((await star.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(errors).toEqual([]);
  });
}

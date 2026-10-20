import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tools, categories } from '../src/tool-catalog.js';

const editor = page => page.locator('#tool-editor');
const field = (page, key) => editor(page).locator(`[data-tool-field="${key}"]`);
const cell = (page, row, key) => editor(page).locator(`[data-tool-row="${row}"][data-tool-column="${key}"]`);
async function open(page, id = 'canvas259') {
  await page.goto(`/#tool/${id}`);
  await expect(page.locator('#view-tools')).toBeVisible();
  await expect(page.locator('#tool-title')).toHaveText(tools.find(t => t.id === id).title);
}
async function choose(page, id) {
  const directory = page.locator('.tool-directory-shell');
  if (!(await directory.evaluate(element => element.open))) await directory.locator(':scope > summary').click();
  await page.locator(`.tool-directory [data-tool-open="${id}"]`).click();
  await expect(page.locator('#tool-title')).toHaveText(tools.find(t => t.id === id).title);
}
async function downloaded(page, action) {
  const waiting = page.waitForEvent('download');
  await action();
  const download = await waiting;
  expect(await download.failure()).toBeNull();
  return { name: download.suggestedFilename(), content: await readFile(await download.path(), 'utf8') };
}

test('all 49 entries open, expose sources and accept real records', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page);
  await expect(page.locator('.tool-directory-item')).toHaveCount(tools.length);
  await expect(page.locator('.tool-directory-group')).toHaveCount(categories.length);
  for (const tool of tools) {
    await choose(page, tool.id);
    await expect(editor(page).locator('.tool-source')).toContainText(tool.source.text);
    if (tool.kind === 'versions') continue;
    let input = editor(page).locator('[data-tool-field]').first();
    if (!(await input.count())) input = editor(page).locator('[data-tool-row]').first();
    if (await input.evaluate(element => element.tagName === 'SELECT')) await input.selectOption({ index: 1 });
    else await input.fill(`检查记录：${tool.id}`);
    await expect(page.locator('#tool-save-state')).toContainText('已保存');
  }
  expect(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('milestone-toolbox-v1')).tools).filter(r => r.updatedAt).length)).toBe(tools.length - 1);
  expect(errors).toEqual([]);
});

test('search, category, milestone and empty results form an actual filtered directory', async ({ page }) => {
  await open(page);
  await page.getByLabel('搜索工具', { exact: true }).fill('OSCAR');
  await expect(page.locator('.tool-directory-item')).toHaveCount(1);
  await expect(page.locator('#tool-title')).toContainText('OSCAR');
  await page.getByLabel('搜索工具', { exact: true }).fill('不存在的工具xyz');
  await expect(page.locator('.tool-directory-item')).toHaveCount(0);
  await expect(editor(page)).toContainText('没有匹配的工具');
  await page.locator('.library-filters [data-tool-clear]').click();
  await page.getByLabel('按类别', { exact: true }).selectOption('经营算账');
  await page.getByLabel('按里程碑', { exact: true }).selectOption('growth');
  const expected = tools.filter(t => t.category === '经营算账' && t.stages.includes('growth'));
  await expect(page.locator('.tool-directory-item')).toHaveCount(expected.length);
});

test('259 keeps all three levels independently across mode switches and reloads', async ({ page }) => {
  await open(page);
  await field(page, 'project').fill('我的项目');
  await field(page, 'canvas5_0').fill('五步需求假设');
  await page.getByRole('button', { name: '2 · 价值与增长', exact: true }).click();
  await field(page, 'canvas2_0').fill('价值假设需要付费验证');
  await page.getByRole('button', { name: '9 · 商业画布', exact: true }).click();
  await field(page, 'canvas9_0').fill('早期细分用户');
  await page.reload();
  await expect(field(page, 'canvas5_0')).toHaveValue('五步需求假设');
  await page.getByRole('button', { name: '2 · 价值与增长', exact: true }).click();
  await expect(field(page, 'canvas2_0')).toHaveValue('价值假设需要付费验证');
  const { content } = await downloaded(page, () => page.getByRole('button', { name: '导出当前工具 .md', exact: true }).click());
  for (const text of ['五步需求假设', '价值假设需要付费验证', '早期细分用户']) expect(content).toContain(text);
});

test('tool records do not overwrite the existing milestone canvas', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('milestone-atlas-v1')) localStorage.setItem('milestone-atlas-v1', JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ status: i === 0 ? '验证中' : '待验证', note: i === 0 ? '旧画布访谈证据' : '' }))));
  });
  await open(page, 'expert-interview');
  await field(page, 'blind').fill('专家访谈新笔记');
  await page.reload();
  await expect(field(page, 'blind')).toHaveValue('专家访谈新笔记');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await expect(page.getByLabel('需求的假设与证据')).toHaveValue('旧画布访谈证据');
  await expect(page.getByLabel('需求验证状态')).toHaveValue('验证中');
});

test('each map milestone links to relevant working tools and a stage filter', async ({ page }) => {
  await page.goto('/');
  await page.locator('.stage-stop[data-stage="2"]').click();
  await page.locator('.stage-tool-links [data-tool-open="unit-calculator"]').click();
  await expect(page.locator('#tool-title')).toContainText('单元模型收入成本计算器');
  await expect(page).toHaveURL(/#tool\/unit-calculator$/);
  await page.getByRole('button', { name: '探索地图', exact: true }).click();
  await expect(page).toHaveURL(/#business$/);
  await page.locator('[data-tool-stage="business"]').click();
  await expect(page.getByLabel('按里程碑', { exact: true })).toHaveValue('business');
  await expect(page.locator('.tool-directory-item')).toHaveCount(tools.filter(t => t.stages.includes('business')).length);
});

test('expert interview has the ten real steps and restores typed notes', async ({ page }) => {
  await open(page, 'expert-interview');
  await expect(editor(page).locator('[data-tool-field]')).toHaveCount(10);
  await field(page, 'discussion').fill('追问具体订单、成本和条件，不只接受观点。');
  await field(page, 'cross').fill('第二位专家给出了一个反例。');
  await page.reload();
  await expect(field(page, 'cross')).toHaveValue(/反例/);
});

test('market calculators display arithmetic and reject percentages outside 0 to 100', async ({ page }) => {
  await open(page, 'tam');
  for (const [key, value] of Object.entries({ customers: '10000', frequency: '2', price: '100', service: '40', obtain: '10' })) await field(page, key).fill(value);
  await expect(page.locator('#tool-calculation-results dd')).toHaveText(['2,000,000', '800,000', '80,000']);
  await field(page, 'obtain').fill('120');
  await expect(page.locator('#tool-validation')).toContainText('0～100');
  await expect(page.locator('#tool-calculation-results')).not.toContainText('80,000');
  await field(page, 'obtain').fill('0');
  await expect(page.locator('#tool-calculation-results dd').last()).toHaveText('0');
  await field(page, 'customers').fill('');
  await expect(page.locator('#tool-calculation-results')).toContainText('待填写');
  await choose(page, 'market-methods');
  for (const [key, value] of Object.entries({ report: '1000', base: '10000', segment: '10', channel: '50', customers: '100', frequency: '2', price: '3', peer: '1000', adjust: '0.8' })) await field(page, key).fill(value);
  await expect(page.locator('#tool-calculation-results dd')).toHaveText(['1,000', '500', '600', '800']);
});

test('unit ledger supports multiple rows and separates capex from operating profit', async ({ page }) => {
  await open(page, 'unit-calculator');
  const rows = [['销售', '收入', '1000'], ['履约', '变动成本', '400'], ['房租', '固定成本', '300'], ['设备', '一次性投入', '2000']];
  for (let i = 0; i < rows.length; i++) {
    if (i) await page.getByRole('button', { name: '＋ 添加一行', exact: true }).click();
    await cell(page, i, 'name').fill(rows[i][0]);
    await cell(page, i, 'type').selectOption(rows[i][1]);
    await cell(page, i, 'amount').fill(rows[i][2]);
  }
  await field(page, 'cash').fill('250');
  const result = page.locator('#tool-calculation-results dd');
  await expect(result.nth(2)).toHaveText('300');
  await expect(result.nth(3)).toHaveText('2,000');
  await expect(result.nth(4)).toHaveText('30%');
  await expect(result.last()).toContainText('8 个核算周期');
  await page.reload();
  await expect(cell(page, 3, 'amount')).toHaveValue('2000');
  await expect(result.nth(2)).toHaveText('300');
});

test('three scenarios calculate independent outcomes including nonpositive cash', async ({ page }) => {
  await open(page, 'three-scenarios');
  const scenarios = [
    { revenue: '100', variable: '150', fixed: '50', investment: '1000', cash: '-20' },
    { revenue: '400', variable: '150', fixed: '50', investment: '1000', cash: '100' },
    { revenue: '800', variable: '200', fixed: '100', investment: '1000', cash: '250' },
  ];
  for (let i = 0; i < scenarios.length; i++) for (const [key, value] of Object.entries(scenarios[i])) await cell(page, i, key).fill(value);
  await expect(page.locator('#tool-calculation-results dd').nth(0)).toHaveText('-100');
  await expect(page.locator('#tool-calculation-results dd').nth(1)).toContainText('非正');
  await expect(page.locator('#tool-calculation-results dd').nth(2)).toHaveText('200');
  await expect(page.locator('#tool-calculation-results dd').nth(4)).toHaveText('500');
  await expect(editor(page).locator('[data-tool-add-row]')).toHaveCount(0);
});

test('dynamic forecasts and conceptual value formulas are interactive', async ({ page }) => {
  await open(page, 'dynamic');
  for (const [key, value] of Object.entries({ units: '10', revenue: '1000', cost: '600', hq: '500' })) await cell(page, 0, key).fill(value);
  await expect(page.locator('#tool-calculation-results dd').first()).toHaveText('3,500');
  await choose(page, 'user-value');
  for (const [key, value] of Object.entries({ new: '9', old: '6', switching: '4' })) await field(page, key).fill(value);
  await expect(page.locator('#tool-calculation-results dd')).toHaveText('-1');
  await expect(page.locator('#tool-calculation-results')).toContainText('不是经过验证的货币价值');
});

test('need quadrants classify without ranking and core metrics handle zero denominators', async ({ page }) => {
  await open(page, 'need-quadrants');
  await cell(page, 0, 'name').fill('低频专业采购');
  await cell(page, 0, 'frequency').selectOption('低频');
  await cell(page, 0, 'rigidity').selectOption('强');
  await expect(page.locator('#tool-calculation-results')).toContainText('信任、单次价值');
  await choose(page, 'core-metrics');
  await cell(page, 0, 'numerator').fill('20');
  await cell(page, 0, 'denominator').fill('100');
  await expect(page.locator('#tool-calculation-results dd').first()).toHaveText('20%');
  await cell(page, 0, 'denominator').fill('0');
  await expect(page.locator('#tool-calculation-results dd').first()).toContainText('未定义');
  await cell(page, 0, 'denominator').fill('10');
  await expect(page.locator('#tool-calculation-results dd').first()).toContainText('分子不能超过');
});

test('version snapshots compare and restore while keeping a pre-restore draft', async ({ page }) => {
  await open(page, 'product-core');
  await field(page, 'user').fill('最初的目标用户');
  await cell(page, 0, 'feature').fill('快速交付');
  await page.getByLabel('本次版本说明', { exact: true }).fill('第一轮访谈');
  await page.getByRole('button', { name: '保存版本', exact: true }).click();
  await field(page, 'user').fill('更新后的目标用户');
  await cell(page, 0, 'feature').fill('降低成本');
  await page.getByRole('button', { name: '比较 / 查看', exact: true }).click();
  const dialog = page.locator('#tool-version-dialog');
  await expect(dialog).toContainText('最初的目标用户');
  await expect(dialog).toContainText('更新后的目标用户');
  await expect(dialog).toContainText('快速交付');
  await expect(dialog).toContainText('降低成本');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '恢复此版本', exact: true }).click();
  await expect(field(page, 'user')).toHaveValue('最初的目标用户');
  await expect(cell(page, 0, 'feature')).toHaveValue('快速交付');
  await expect(editor(page).locator('.tool-versions li')).toHaveCount(2);
  await expect(editor(page)).toContainText('恢复前自动保留的草稿');
  await page.reload();
  await expect(editor(page).locator('.tool-versions li')).toHaveCount(2);
  await choose(page, 'version-history');
  await expect(editor(page)).toContainText('第一轮访谈');
  await expect(editor(page)).toContainText('恢复前自动保留的草稿');
});

test('removing nonempty rows asks for confirmation and cancellation preserves data', async ({ page }) => {
  await open(page, 'competitors');
  await cell(page, 0, 'name').fill('不能悄悄删除的竞品笔记');
  page.once('dialog', d => d.dismiss());
  await page.getByRole('button', { name: '移除第 1 行', exact: true }).click();
  await expect(cell(page, 0, 'name')).toHaveValue('不能悄悄删除的竞品笔记');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '移除第 1 行', exact: true }).click();
  await expect(editor(page).locator('tbody tr')).toHaveCount(0);
  await page.getByRole('button', { name: '＋ 添加一行', exact: true }).click();
  await expect(cell(page, 0, 'name')).toHaveValue('');
});

test('JSON backup restores all tool versions and the old stage canvas', async ({ page }) => {
  await open(page);
  await field(page, 'project').fill('完整备份中的项目');
  await page.getByLabel('本次版本说明', { exact: true }).fill('备份版本');
  await page.getByRole('button', { name: '保存版本', exact: true }).click();
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('完整备份中的旧画布');
  await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
  const backup = await downloaded(page, () => page.getByRole('button', { name: '备份全部 .json', exact: true }).click());
  const parsed = JSON.parse(backup.content.replace(/^﻿/, ''));
  expect(parsed.library.tools.canvas259.history).toHaveLength(1);
  expect(parsed.stageCanvas[0].note).toContain('旧画布');
  await field(page, 'project').fill('备份后改动');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await page.getByLabel('需求的假设与证据').fill('备份后改动旧画布');
  await page.getByRole('button', { name: '验证工具箱', exact: true }).click();
  const cancelImport = page.waitForEvent('dialog');
  await page.locator('#tool-import-file').setInputFiles({ name: backup.name, mimeType: 'application/json', buffer: Buffer.from(backup.content) });
  await (await cancelImport).dismiss();
  await expect(page.locator('#tool-import-file')).toHaveValue('');
  await expect(field(page, 'project')).toHaveValue('备份后改动');
  const acceptImport = page.waitForEvent('dialog');
  await page.locator('#tool-import-file').setInputFiles({ name: backup.name, mimeType: 'application/json', buffer: Buffer.from(backup.content) });
  await (await acceptImport).accept();
  await expect(page.locator('.toast')).toContainText('记录和版本均已恢复');
  await expect(field(page, 'project')).toHaveValue('完整备份中的项目');
  await expect(editor(page).locator('.tool-versions li')).toHaveCount(1);
  await page.reload();
  await expect(field(page, 'project')).toHaveValue('完整备份中的项目');
  await page.getByRole('button', { name: '作战画布', exact: true }).click();
  await expect(page.getByLabel('需求的假设与证据')).toHaveValue('完整备份中的旧画布');
});

test('Markdown export contains actual multi-tool notes, tables and calculation limits', async ({ page }) => {
  await open(page, 'expert-interview');
  await field(page, 'cross').fill('访谈反例保留在导出中');
  await choose(page, 'tam');
  for (const [key, value] of Object.entries({ customers: '100', frequency: '2', price: '10', service: '50', obtain: '10' })) await field(page, key).fill(value);
  const { content } = await downloaded(page, () => page.getByRole('button', { name: '导出全部记录 .md', exact: true }).click());
  expect(content).toContain('访谈反例保留在导出中');
  expect(content).toContain('TAM · 潜在年收入空间：2,000');
  expect(content).toContain('不是 GMV、利润');
  expect(content).toContain('正文缺失');
});

test('bad backup files never overwrite the working draft', async ({ page }) => {
  await open(page);
  await field(page, 'project').fill('必须保留的草稿');
  await page.locator('#tool-import-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
  await expect(page.locator('.toast')).toContainText('未导入');
  await expect(field(page, 'project')).toHaveValue('必须保留的草稿');
  await page.locator('#tool-import-file').setInputFiles({ name: 'unknown.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'milestone-toolbox-backup-v1', library: { schema: 1, tools: { unknown: {} } } })) });
  await expect(page.locator('.toast')).toContainText('未知工具');
  await expect(field(page, 'project')).toHaveValue('必须保留的草稿');
});

test('stored text and version notes never become executable HTML', async ({ page }) => {
  const payload = '<img src=x onerror="window.__injected=true"><script>window.__injected=true</script>';
  await open(page);
  await field(page, 'project').fill(payload);
  await page.getByLabel('本次版本说明', { exact: true }).fill(payload);
  await page.getByRole('button', { name: '保存版本', exact: true }).click();
  await page.reload();
  await expect(field(page, 'project')).toHaveValue(payload);
  await page.getByRole('button', { name: '比较 / 查看', exact: true }).click();
  await page.locator('#tool-version-content summary').click();
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  await expect(page.locator('#tool-workspace img, #tool-workspace script')).toHaveCount(0);
});

test('storage denial keeps tool data and versions exportable without false save claims', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); }; });
  await open(page, 'experiment');
  await field(page, 'hypothesis').fill('只能在内存中的实验');
  await expect(page.locator('#tool-save-state')).toContainText('未能保存');
  await page.getByRole('button', { name: '保存版本', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('仅保留在当前会话');
  const { content } = await downloaded(page, () => page.getByRole('button', { name: '备份全部 .json', exact: true }).click());
  expect(content).toContain('只能在内存中的实验');
  expect(JSON.parse(content.replace(/^﻿/, '')).library.tools.experiment.history).toHaveLength(1);
});

test('corrupt existing storage is not silently overwritten', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('milestone-toolbox-v1', '{broken'));
  await open(page);
  await field(page, 'project').fill('当前会话的新草稿');
  await expect(page.locator('#tool-save-state')).toContainText('未覆盖原数据');
  expect(await page.evaluate(() => localStorage.getItem('milestone-toolbox-v1'))).toBe('{broken');
});

test('source-limited tools expose their actual limitations rather than reconstructed chapters', async ({ page }) => {
  await open(page, 'growth-cycle');
  for (const id of ['growth-cycle', 'growth-flywheel', 'moat-model']) {
    await choose(page, id);
    await expect(editor(page).locator('.tool-source-badge')).toHaveText('正文缺失');
    await expect(editor(page)).toContainText(/不是|不代表/);
  }
  await choose(page, 'false-substrategies');
  await expect(editor(page)).toContainText('不声称已恢复完整小抄');
  await choose(page, 'kano');
  await expect(editor(page).locator('.tool-source-badge')).toHaveText('仅提及');
});

test('keyboard, reduced motion and WebGL fallback leave tools fully usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return ['webgl', 'webgl2', 'experimental-webgl'].includes(type) ? null : original.call(this, type, ...args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#text-map')).toBeVisible();
  await page.locator('.stage-tool-links [data-tool-open="need-four"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tool-title')).toBeFocused();
  await expect(page.locator('#tool-title')).toContainText('需求四字诀');
  await field(page, 'scene').fill('键盘与降级模式仍能填写');
  await expect(page.locator('#tool-save-state')).toContainText('已保存');
});

test('mobile workbench keeps page width contained while tables scroll inside', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'three-scenarios');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '表格', exact: true }).click();
  const table = editor(page).locator('.tool-table-scroll');
  expect(await table.evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
  await table.evaluate(e => { e.scrollLeft = e.scrollWidth; });
  await cell(page, 0, 'cash').fill('-100');
  await expect(cell(page, 0, 'cash')).toHaveValue('-100');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/library-mobile.png', fullPage: true });
  await choose(page, 'expert-interview');
  await expect(page.locator('#tool-title')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

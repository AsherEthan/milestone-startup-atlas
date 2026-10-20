import { test, expect } from '@playwright/test';
import { calculate, readNumber } from '../src/tool-math.js';
import { cleanState, fieldsFor, newRecord } from '../src/tool-store.js';
import { tools } from '../src/tool-catalog.js';

const values = data => ({ values: data, rows: [] });
const output = (kind, data) => calculate(kind, values(data)).rows.map(row => row.value);

test('numbers distinguish blanks, zero, negatives, percentages and overflow', () => {
  expect(readNumber('').error).toBe('待填写');
  expect(readNumber('  ').error).toBe('待填写');
  expect(readNumber('0').value).toBe(0);
  expect(readNumber('-1').error).toBeTruthy();
  expect(readNumber('-1', { signed: true }).value).toBe(-1);
  for (const number of ['Infinity', 'NaN', '1e100', '--2']) expect(readNumber(number).error).toBeTruthy();
  expect(readNumber('101', { percent: true }).error).toBeTruthy();
  expect(readNumber('100', { percent: true }).value).toBe(100);
});

test('TAM narrows the same market and rejects invalid percentages', () => {
  const data = { customers: '10000', frequency: '2', price: '100', service: '40', obtain: '10' };
  expect(output('tam', data)).toEqual(['2,000,000', '800,000', '80,000']);
  expect(output('tam', { ...data, service: '0' })).toEqual(['2,000,000', '0', '0']);
  expect(output('tam', { ...data, obtain: '101' })[0]).toContain('0～100');
  expect(output('tam', { ...data, customers: '' })[0]).toContain('待填写');
  expect(output('tam', { ...data, customers: '1e15', frequency: '1e15' })[0]).toContain('超出');
});

test('four market estimates do not silently average or fill missing data', () => {
  expect(output('market', { report: '1000', base: '10000', segment: '10', channel: '50', customers: '100', frequency: '2', price: '3', peer: '1000', adjust: '0.8' })).toEqual(['1,000', '500', '600', '800']);
  const result = output('market', { report: '0' });
  expect(result[0]).toBe('0');
  expect(result.slice(1).every(value => value.includes('待填写'))).toBe(true);
});

test('user value stays conceptual and accepts signed experiences', () => {
  expect(output('value', { new: '9', old: '6', switching: '4' })).toEqual(['-1']);
  expect(output('value', { new: '-2', old: '-5', switching: '1' })).toEqual(['2']);
  expect(output('value', { new: '9', old: '6', switching: '-1' })[0]).toContain('不能为负');
});

test('unit economics separates capex, accounting profit and cash payback', () => {
  const record = { values: { cash: '250' }, rows: [
    { name: '销售', type: '收入', amount: '1000' },
    { name: '履约', type: '变动成本', amount: '400' },
    { name: '房租', type: '固定成本', amount: '300' },
    { name: '设备', type: '一次性投入', amount: '2000' },
  ] };
  const result = calculate('unit', record).rows.map(r => r.value);
  expect(result.slice(0, 5)).toEqual(['1,000', '700', '300', '2,000', '30%']);
  expect(result[5]).toContain('8 个核算周期');
  expect(calculate('unit', { ...record, values: { cash: '0' } }).rows.at(-1).value).toContain('非正');
  expect(calculate('unit', { ...record, values: {} }).rows.at(-1).value).toContain('不用利润');
  expect(calculate('unit', { rows: [{ name: '设备', type: '一次性投入', amount: '1' }] }).rows[4].value).toContain('收入为 0');
  expect(calculate('unit', { rows: [{ name: '销售', type: '收入', amount: '' }] }).rows[0].value).toContain('待填写');
});

test('three scenarios remain independent, including negative cash flows', () => {
  const rows = [
    { scenario: '悲观', revenue: '100', variable: '150', fixed: '50', investment: '1000', cash: '-20' },
    { scenario: '合理', revenue: '400', variable: '150', fixed: '50', investment: '1000', cash: '100' },
    { scenario: '乐观', revenue: '', variable: '', fixed: '', investment: '', cash: '' },
  ];
  const result = calculate('scenarios', { rows }).rows;
  expect(result[0].value).toBe('-100');
  expect(result[1].value).toContain('非正');
  expect(result[2].value).toBe('200');
  expect(result[3].value).toContain('10 个核算周期');
  expect(result[4].value).toContain('待填写');
});

test('dynamic forecasting subtracts unallocated overhead once', () => {
  expect(calculate('dynamic', { rows: [{ units: '10', revenue: '1000', cost: '600', hq: '500' }] }).rows[0].value).toBe('3,500');
  expect(calculate('dynamic', { rows: [{ units: '-1', revenue: '1000', cost: '600', hq: '500' }] }).rows[0].error).toBe(true);
});

test('profit matrix distinguishes break-even and noncore company gains', () => {
  expect(output('profit', { unit: '1', company: '1' })[0]).toContain('不自动证明');
  expect(output('profit', { unit: '1', company: '-1' })[0]).toContain('总部');
  expect(output('profit', { unit: '-1', company: '-1' })[0]).toContain('停止复制');
  expect(output('profit', { unit: '-1', company: '1' })[0]).toContain('其他业务');
  expect(output('profit', { unit: '0', company: '0' })[0]).toContain('盈亏平衡');
});

test('rates handle zero denominator, impossible numerators and explicit zeros', () => {
  const result = calculate('rates', { rows: [{ metric: '留存率', numerator: '50', denominator: '100' }, { metric: '完课率', numerator: '0', denominator: '0' }, { metric: '推荐率', numerator: '2', denominator: '1' }, { metric: '退款率', numerator: '0', denominator: '10' }] });
  expect(result.rows[0].value).toBe('50%');
  expect(result.rows[1].value).toContain('未定义');
  expect(result.rows[2].error).toBe(true);
  expect(result.rows[3].value).toBe('0%');
});

test('all catalog entries have safe unique schemas and honest reference boundaries', () => {
  expect(tools.length).toBe(49);
  expect(new Set(tools.map(t => t.id)).size).toBe(tools.length);
  for (const tool of tools) {
    expect(tool.source.text.length).toBeGreaterThan(0);
    const fields = fieldsFor(tool);
    expect(new Set(fields.map(f => f.key)).size).toBe(fields.length);
    if (tool.kind !== 'versions') expect(fields.length + (tool.table?.columns.length || 0)).toBeGreaterThan(0);
  }
  for (const id of ['growth-cycle', 'growth-flywheel', 'moat-model']) expect(tools.find(t => t.id === id).source.level).toBe('正文缺失');
});

test('backup validation rejects unknown tools, nested objects and oversized records', () => {
  const tool = tools[0];
  const backup = record => ({ schema: 1, tools: { [tool.id]: record } });
  const record = newRecord(tool);
  record.values.project = '<script>not executed</script>';
  expect(cleanState(backup(record)).tools[tool.id].values.project).toContain('<script>');
  expect(() => cleanState({ schema: 2, tools: {} })).toThrow();
  expect(() => cleanState({ schema: 1, tools: { unknown: {} } })).toThrow();
  expect(() => cleanState(backup({ values: { project: {} } }))).toThrow();
  expect(() => cleanState(backup({ values: { project: 'x'.repeat(5001) } }))).toThrow();
  expect(() => cleanState(backup({ rows: Array.from({ length: 101 }, () => ({})) }))).toThrow();
  expect(() => cleanState(backup({ history: [{ id: 'same' }, { id: 'same' }] }))).toThrow();
  const scenarios = tools.find(t => t.id === 'three-scenarios');
  expect(() => cleanState({ schema: 1, tools: { [scenarios.id]: { rows: [{}] } } })).toThrow();
});

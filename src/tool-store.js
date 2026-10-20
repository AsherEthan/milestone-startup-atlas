import { tools, canvasModes } from './tool-catalog.js';

export const TOOL_STORAGE_KEY = 'milestone-toolbox-v1';
export const MAX_ROWS = 100;
export const MAX_VERSIONS = 50;
const clone = value => structuredClone(value);
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 5000) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('字段必须是文本或数字');
  if (String(value).length > max) throw new Error(`字段不能超过 ${max} 字`);
  return String(value);
};
export function fieldsFor(tool) {
  if (tool.kind !== 'canvas259') return tool.fields;
  return [...tool.fields, ...Object.entries(canvasModes).flatMap(([mode, labels]) => labels.map((label, i) => ({ key: `canvas${mode}_${i}`, label: `${mode} 要素 · ${label}`, type: 'textarea' })))];
}
export function newRecord(tool) {
  return { values: {}, rows: clone(tool.table?.rows || []), updatedAt: '', history: [], draftNote: '' };
}
function cleanContent(tool, raw) {
  if (!isObject(raw) || (raw.values !== undefined && !isObject(raw.values))) throw new Error('工具内容结构不正确');
  const values = Object.fromEntries(fieldsFor(tool).map(field => [field.key, text(raw.values?.[field.key])]));
  const rows = raw.rows ?? tool.table?.rows ?? [];
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new Error(`每个工具最多 ${MAX_ROWS} 行`);
  if (tool.table?.fixed && rows.length !== tool.table.rows.length) throw new Error('固定情景表的行数不正确');
  const cleanedRows = tool.table ? rows.map(row => {
    if (!isObject(row)) throw new Error('表格行结构不正确');
    return Object.fromEntries(tool.table.columns.map(column => [column.key, text(row[column.key])]));
  }) : [];
  return { values, rows: cleanedRows };
}
export function cleanState(raw) {
  if (!isObject(raw) || raw.schema !== 1 || !isObject(raw.tools)) throw new Error('不是受支持的工具库备份格式');
  const cleaned = { schema: 1, tools: {} };
  for (const [id, record] of Object.entries(raw.tools)) {
    const tool = tools.find(entry => entry.id === id);
    if (!tool) throw new Error(`备份含未知工具：${id.slice(0, 60)}`);
    const content = cleanContent(tool, record);
    const history = record.history ?? [];
    if (!Array.isArray(history) || history.length > MAX_VERSIONS) throw new Error(`每个工具最多 ${MAX_VERSIONS} 个版本`);
    const ids = new Set();
    cleaned.tools[id] = {
      ...content, updatedAt: text(record.updatedAt, 100), draftNote: text(record.draftNote, 200),
      history: history.map(version => {
        if (!isObject(version)) throw new Error('版本结构不正确');
        const id = text(version.id, 100);
        if (!id || ids.has(id)) throw new Error('版本编号为空或重复');
        ids.add(id);
        return { ...cleanContent(tool, version), id, time: text(version.time, 100), note: text(version.note, 200) };
      }),
    };
  }
  return cleaned;
}

export function createToolStore() {
  let state = { schema: 1, tools: {} };
  let loadError = '';
  let locked = false;
  try {
    const saved = localStorage.getItem(TOOL_STORAGE_KEY);
    if (saved) state = cleanState(JSON.parse(saved));
  } catch {
    loadError = '本地记录读取失败，未覆盖原数据；当前填写仍可导出';
    locked = true;
  }
  const api = {
    get state() { return state; },
    get loadError() { return loadError; },
    get(tool) {
      return state.tools[tool.id] ||= newRecord(tool);
    },
    save() {
      if (locked) return false;
      try {
        localStorage.setItem(TOOL_STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch { return false; }
    },
    update(tool) {
      api.get(tool).updatedAt = new Date().toISOString();
      return api.save();
    },
    snapshot(tool, note) {
      const record = api.get(tool);
      if (record.history.length >= MAX_VERSIONS) throw new Error(`已达 ${MAX_VERSIONS} 个版本，请先导出备份，再手动移除不再需要的版本；不会自动删除旧版本`);
      const version = { id: crypto.randomUUID(), time: new Date().toISOString(), note: note || '未填写版本说明', values: clone(record.values), rows: clone(record.rows) };
      record.history.push(version);
      return { version, saved: api.update(tool) };
    },
    restore(tool, versionId) {
      const record = api.get(tool);
      const version = record.history.find(v => v.id === versionId);
      if (!version) throw new Error('未找到此版本');
      api.snapshot(tool, '恢复前自动保留的草稿');
      record.values = clone(version.values);
      record.rows = clone(version.rows);
      return api.update(tool);
    },
    removeVersion(tool, versionId) {
      const record = api.get(tool);
      const index = record.history.findIndex(version => version.id === versionId);
      if (index < 0) throw new Error('未找到此版本');
      record.history.splice(index, 1);
      return api.update(tool);
    },
    replace(cleaned) {
      state = cleaned;
      locked = false;
      loadError = '';
      return api.save();
    },
  };
  return api;
}

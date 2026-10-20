import { tools, categories, canvasModes } from './tool-catalog.js';
import { calculate, readNumber } from './tool-math.js';
import { createToolStore, fieldsFor, cleanState, MAX_ROWS, MAX_VERSIONS } from './tool-store.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const markdown = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cellMarkdown = value => markdown(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const stageNames = { need: '需求', solution: '解决方案', business: '商业模式', growth: '增长', moat: '壁垒' };
const dateText = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间未记录' : date.toLocaleString('zh-CN', { hour12: false });
};
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob(['﻿', content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const today = () => new Date().toLocaleDateString('sv-SE');

export const stageToolIds = {
  need: ['need-four', 'need-triangle', 'market-methods', 'tam'],
  solution: ['product-core', 'core-checks', 'false', 'experiment'],
  business: ['unit-types', 'unit-calculator', 'three-scenarios', 'business-cycle'],
  growth: ['dynamic', 'growth-cycle', 'growth-flywheel', 'scale-economics'],
  moat: ['moat-model', 'scale-economics', 'tam', 'cross-validation'],
};
export function stageToolLinks(stage) {
  const ids = stageToolIds[stage];
  const link = id => `<button data-tool-open="${id}">${escape(tools.find(t => t.id === id).title)} <span aria-hidden="true">↗</span></button>`;
  return `<div class="stage-tool-links"><span>打开这一关的工作表</span>${ids.slice(0, 2).map(link).join('')}<details class="stage-tool-more"><summary>更多工作表</summary>${ids.slice(2).map(link).join('')}</details><button data-tool-stage="${stage}">查看本阶段全部工具 →</button></div>`;
}

export function mountToolbox({ onOpen, notify, getLegacyRecords, importLegacyRecords }) {
  const root = document.querySelector('#tool-workspace');
  const store = createToolStore();
  let selected = tools[0].id;
  let canvasMode = '5';
  let category = '';
  let stage = '';
  let query = '';
  let empty = false;
  const mobileQuery = matchMedia('(max-width: 760px)');
  let tableMode = mobileQuery.matches ? 'cards' : 'table';
  let saved = !store.loadError;
  let status = store.loadError || '填写后自动保存在此浏览器';
  root.innerHTML = `
    <div class="tool-library-heading"><div><span class="eyebrow">FROM FRAMEWORK TO FIELDWORK</span><h2>完整创业工具库 <span>${tools.length} 个入口</span></h2><p>画布、访谈、调研、比较、算账、实验与复盘，都在这里落地。</p></div><div class="library-actions"><button data-library-export="markdown">导出全部记录 .md</button><button data-library-export="json">备份全部 .json</button><button data-library-import>导入备份</button><input type="file" id="tool-import-file" accept=".json,application/json" hidden></div></div>
    <div class="tool-starts" aria-label="常用工具快捷入口"><span>从一个问题开始</span>${[['canvas259', '梳理项目', '259 假设画布'], ['expert-interview', '找到盲区', '专家访谈'], ['product-core', '验证产品', '产品内核'], ['unit-calculator', '算清这笔账', '单元模型']].map(([id, label, name], i) => `<button data-tool-open="${id}"><span class="tool-start-number" aria-hidden="true">0${i + 1}</span><span><strong>${label}</strong><small>${name}</small></span><span class="tool-start-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
    <p class="library-notice">仅在本地保存，不上传。<strong>原文框架、实操归纳与资料缺失会分别标注。</strong>“保存版本”可留存每一轮认知；清理浏览器前请导出 JSON 备份。</p>
    <div class="library-filters"><label class="tool-search-label">搜索工具<input id="tool-search" type="search" placeholder="试试：访谈、TAM、单元模型…" maxlength="100"></label><label><span id="tool-category-label">按类别</span><select id="tool-category" aria-labelledby="tool-category-label"><option value="">全部类别</option>${categories.map(c => `<option>${c}</option>`).join('')}</select></label><label><span id="tool-stage-label">按里程碑</span><select id="tool-stage" aria-labelledby="tool-stage-label"><option value="">全部阶段</option>${Object.entries(stageNames).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}</select></label><button data-tool-clear>清除筛选</button></div>
    <div class="library-meta"><span id="tool-result-count" role="status"></span><span id="tool-save-state" role="status"></span></div>
    <div class="tool-workbench"><details class="tool-directory-shell" ${mobileQuery.matches ? '' : 'open'}><summary><span>工具目录</span><span class="tool-current-selection"></span></summary><nav class="tool-directory" aria-label="工具目录"></nav></details><article id="tool-editor" class="tool-editor" aria-label="当前工具工作台"></article></div>
    <dialog id="tool-version-dialog" aria-labelledby="version-dialog-title"><div class="dialog-top"><span class="eyebrow">VERSION / EVIDENCE</span><button class="icon-button" data-tool-dialog-close aria-label="关闭版本比较">×</button></div><h2 id="version-dialog-title">版本与当前草稿比较</h2><div id="tool-version-content"></div><button class="primary-button" data-tool-dialog-close>关闭比较</button></dialog>`;
  const $ = selector => root.querySelector(selector);
  function updateStatus(ok, label) {
    saved = ok;
    status = ok ? (label || '已保存在此浏览器') : (store.loadError || '未能保存到浏览器，请立即导出备份；当前会话仍可编辑');
    $('#tool-save-state').textContent = status;
    $('#tool-save-state').classList.toggle('save-failed', !ok);
  }
  updateStatus(saved, status);
  const currentTool = () => tools.find(t => t.id === selected);
  function matches() {
    const q = query.trim().toLocaleLowerCase();
    return tools.filter(t => (!category || category === t.category) && (!stage || t.stages.includes(stage)) && (!q || `${t.title} ${t.desc} ${t.category} ${t.steps.join(' ')} ${t.fields.map(f => f.label).join(' ')}`.toLocaleLowerCase().includes(q)));
  }
  function renderDirectory() {
    const visible = matches();
    $('#tool-result-count').textContent = `找到 ${visible.length} / ${tools.length} 个工具`;
    $('.tool-current-selection').textContent = empty ? '没有匹配的工具' : currentTool().title;
    $('.tool-directory').innerHTML = visible.length ? categories.map(c => {
      const list = visible.filter(t => t.category === c);
      return list.length ? `<div class="tool-directory-group"><h3>${c} <span>${list.length}</span></h3>${list.map(t => `<button data-tool-open="${t.id}" class="tool-directory-item ${t.id === selected ? 'active' : ''}" aria-pressed="${t.id === selected}"><span>${escape(t.title)}</span><small>${escape(t.source.level)}${store.state.tools[t.id]?.updatedAt ? ' · 已记录' : ''}</small></button>`).join('')}</div>` : '';
    }).join('') : '<p class="tool-empty">没有匹配的工具。试试其他关键词，或清除筛选。</p>';
  }
  function selectionOptions(field, value) {
    const options = field.options || [];
    const unknown = value && !options.includes(value) ? `<option value="${escape(value)}" selected>待核选项：${escape(value)}</option>` : '';
    return `<option value="">请选择</option>${unknown}${options.map(v => `<option value="${escape(v)}" ${value === v ? 'selected' : ''}>${escape(v)}</option>`).join('')}`;
  }
  function control(field, value, attrs) {
    if (field.type === 'select') return `<select ${attrs}>${selectionOptions(field, value)}</select>`;
    if (field.type === 'textarea') return `<textarea ${attrs} rows="3" maxlength="5000">${escape(value)}</textarea>`;
    const numeric = field.type === 'number';
    return `<input ${attrs} type="${numeric ? 'number' : 'text'}" ${numeric ? `step="any" max="${field.label.includes('（%）') ? 100 : 1e15}" ${field.signed ? '' : 'min="0"'} inputmode="decimal"` : 'maxlength="5000"'} value="${escape(value)}">`;
  }
  function renderFields(tool, record) {
    let fields = tool.fields;
    let chooser = '';
    if (tool.kind === 'canvas259') {
      chooser = `<div class="canvas-mode-switch" role="group" aria-label="259 画布粒度">${[['2', '2 · 价值与增长'], ['5', '5 · 里程碑'], ['9', '9 · 商业画布']].map(([mode, label]) => `<button data-canvas-mode="${mode}" aria-pressed="${mode === canvasMode}" class="${mode === canvasMode ? 'active' : ''}">${label}</button>`).join('')}</div><p class="field-hint">不同粒度分别保存。切换不会清空已填内容，导出和版本会包含三个粒度。</p>`;
      fields = [...tool.fields, ...fieldsFor(tool).filter(field => field.key.startsWith(`canvas${canvasMode}_`))];
    }
    return `${chooser}<div class="tool-form-grid">${fields.map(field => {
      const id = `tool-${tool.id}-${field.key}`;
      return `<div class="tool-field ${field.type === 'textarea' ? 'wide-field' : ''}"><label for="${id}">${escape(field.label)}</label>${field.help ? `<p class="field-hint" id="${id}-help">${escape(field.help)}</p>` : ''}${control(field, record.values[field.key] || '', `id="${id}" data-tool-field="${field.key}" ${field.help ? `aria-describedby="${id}-help"` : ''}`)}</div>`;
    }).join('')}</div>`;
  }
  function renderTable(tool, record) {
    if (!tool.table) return '';
    const modeButtons = `<div class="tool-table-modes" role="group" aria-label="记录展示方式"><button data-table-mode="cards" aria-pressed="${tableMode === 'cards'}">卡片</button><button data-table-mode="table" aria-pressed="${tableMode === 'table'}">表格</button></div>`;
    const header = tool.table.columns.map(column => `<th scope="col">${escape(column.label)}</th>`).join('');
    const rows = record.rows.map((row, index) => `<tr><th scope="row"><span class="row-index-prefix">记录 </span>${String(index + 1).padStart(2, '0')}</th>${tool.table.columns.map(column => `<td data-label="${escape(column.label)}">${control(column, row[column.key] || '', `data-tool-row="${index}" data-tool-column="${column.key}" aria-label="第 ${index + 1} 行 · ${escape(column.label)}"`)}</td>`).join('')}${tool.table.fixed ? '' : `<td data-label="操作" class="row-operation"><button class="row-remove" data-tool-row-remove="${index}" aria-label="移除第 ${index + 1} 行">移除此行</button></td>`}</tr>`).join('');
    return `<section class="tool-table-section" data-table-mode="${tableMode}"><div class="tool-section-title"><h4>记录与对照表</h4><span>${record.rows.length} / ${tool.table.fixed ? tool.table.rows.length : MAX_ROWS} 行</span>${modeButtons}</div><div class="tool-table-scroll" tabindex="0" role="region" aria-label="${tableMode === 'cards' ? '记录卡片' : '可横向滚动的记录表'}"><table class="tool-data-table"><caption class="sr-only">${escape(tool.title)}记录表</caption><thead><tr><th scope="col">#</th>${header}${tool.table.fixed ? '' : '<th scope="col">操作</th>'}</tr></thead><tbody>${rows}</tbody></table></div>${tool.table.fixed ? '' : `<button class="tool-add-row" data-tool-add-row ${record.rows.length >= MAX_ROWS ? 'disabled' : ''}>＋ 添加一行</button>`}<p class="field-hint">数值行请显式填写 0；空白不是 0。金额、周期与数量口径保持一致。</p></section>`;
  }
  function setTableMode(mode) {
    if (!['cards', 'table'].includes(mode)) return;
    tableMode = mode;
    const section = $('.tool-table-section');
    if (!section) return;
    section.dataset.tableMode = mode;
    section.querySelector('.tool-table-scroll').setAttribute('aria-label', mode === 'cards' ? '记录卡片' : '可横向滚动的记录表');
    section.querySelectorAll('[data-table-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tableMode === mode)));
  }
  function renderVersions(tool, global = false) {
    const entries = global ? tools.flatMap(t => (store.state.tools[t.id]?.history || []).map(v => ({ tool: t, version: v }))) : store.get(tool).history.map(v => ({ tool, version: v }));
    entries.sort((a, b) => b.version.time.localeCompare(a.version.time));
    return `<section class="tool-versions"><h4>${global ? '所有工具的版本记录' : '已保存版本'} <span>${entries.length}${global ? '' : ` / ${MAX_VERSIONS}`}</span></h4>${entries.length ? `<ol>${entries.map(({ tool: t, version: v }) => `<li><div><strong>${escape(v.note)}</strong><small>${global ? `${escape(t.title)} · ` : ''}${escape(dateText(v.time))}</small></div><div class="version-actions"><button data-tool-compare="${t.id}" data-version-id="${escape(v.id)}">比较 / 查看</button><button data-tool-restore="${t.id}" data-version-id="${escape(v.id)}">恢复此版本</button><button data-tool-remove-version="${t.id}" data-version-id="${escape(v.id)}">移除此版本</button></div></li>`).join('')}</ol>` : '<p class="field-hint">还没有版本。在工具里填写并点击“保存版本”，即可留住这一轮判断。</p>'}</section>`;
  }
  function renderEditor() {
    if (empty) { $('#tool-editor').innerHTML = '<div class="tool-empty"><h3>没有匹配的工具</h3><p>清除筛选后继续填写。已有记录不会被清除。</p><button data-tool-clear>清除筛选</button></div>'; return; }
    const tool = currentTool();
    const record = store.get(tool);
    $('#tool-editor').innerHTML = `<div class="tool-editor-top"><span>${tool.category} / ${String(tools.indexOf(tool) + 1).padStart(2, '0')}</span><span class="tool-source-badge">${escape(tool.source.level)}</span></div><h3 id="tool-title" tabindex="-1">${escape(tool.title)}</h3><p class="tool-description">${escape(tool.desc)}</p><p class="tool-source">来源：${escape(tool.source.text)}。填写界面由本站制作。</p>${tool.steps.length ? `<details class="tool-instructions" ${/缺失|OCR|提及/.test(tool.source.level) ? 'open' : ''}><summary>使用要点与资料边界</summary><ul>${tool.steps.map(s => `<li>${escape(s)}</li>`).join('')}</ul></details>` : ''}
      ${tool.kind === 'versions' ? renderVersions(tool, true) : `${renderFields(tool, record)}${renderTable(tool, record)}<div id="tool-validation" role="status" aria-live="polite"></div>${tool.calc ? '<section class="tool-calculation" aria-label="测算结果"><h4>按当前输入测算</h4><div id="tool-calculation-results" aria-live="polite"></div></section>' : ''}<div class="tool-editor-actions"><div><label for="tool-version-note">本次版本说明</label><input id="tool-version-note" data-version-note maxlength="200" placeholder="例如：访谈后调整了目标用户" value="${escape(record.draftNote)}"></div><button data-tool-snapshot>保存版本</button><button data-tool-export>导出当前工具 .md</button></div>${renderVersions(tool)}`}`;
    renderResults();
  }
  function renderResults() {
    const tool = currentTool();
    const record = store.get(tool);
    const validation = $('#tool-validation');
    if (!validation) return;
    const errors = [];
    const check = (field, value, label) => {
      if (!String(value ?? '').trim()) return;
      if (field.type === 'number') {
        const parsed = readNumber(value, { signed: field.signed, percent: field.label.includes('（%）') });
        if (parsed.error) errors.push(`${label}：${parsed.error}`);
      } else if (field.type === 'select' && !field.options.includes(value)) errors.push(`${label}：请重新选择当前支持的选项`);
    };
    fieldsFor(tool).forEach(field => check(field, record.values[field.key], field.label));
    record.rows.forEach((row, i) => tool.table?.columns.forEach(c => check(c, row[c.key], `第 ${i + 1} 行 ${c.label}`)));
    validation.innerHTML = errors.length ? `<div class="tool-input-errors"><strong>请检查输入（已保留草稿，错误值不应作为结论）</strong><ul>${errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul></div>` : '';
    if (tool.calc) {
      const output = calculate(tool.calc, record);
      $('#tool-calculation-results').innerHTML = `<dl class="calculation-list">${output.rows.map(row => `<div ${row.error ? 'class="calculation-error"' : ''}><dt>${escape(row.label)}</dt><dd>${escape(row.value)}</dd></div>`).join('')}</dl>${output.note ? `<p class="field-hint">${escape(output.note)}</p>` : ''}`;
    }
  }
  function filterTools() {
    const visible = matches();
    empty = !visible.length;
    if (visible.length && !visible.some(t => t.id === selected)) selected = visible[0].id;
    renderDirectory();
    renderEditor();
    // 替换地址而不触发 hashchange，搜索框的焦点不会被抢走。
    if (!empty) history.replaceState(null, '', `#tool/${selected}`);
  }
  function openTool(id, focus = true) {
    if (!tools.some(t => t.id === id)) return false;
    selected = id;
    empty = false;
    if (!matches().some(t => t.id === id)) {
      category = ''; stage = ''; query = '';
      $('#tool-category').value = ''; $('#tool-stage').value = ''; $('#tool-search').value = '';
    }
    onOpen();
    history.replaceState(null, '', `#tool/${id}`);
    renderDirectory();
    renderEditor();
    if (focus) {
      if (mobileQuery.matches) $('.tool-directory-shell').open = false;
      $('#tool-title').focus({ preventScroll: true });
      if (mobileQuery.matches) $('#tool-editor').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    return true;
  }
  function clearFilters() {
    category = ''; stage = ''; query = '';
    $('#tool-category').value = ''; $('#tool-stage').value = ''; $('#tool-search').value = '';
    filterTools();
  }
  function markdownForTool(tool, record) {
    const values = record.values;
    const rows = record.rows;
    const fields = fieldsFor(tool).map(field => `### ${field.label}\n\n${markdown(values[field.key] || '（尚未记录）')}\n`).join('\n');
    const table = tool.table ? `\n| ${tool.table.columns.map(c => c.label).join(' | ')} |\n| ${tool.table.columns.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${tool.table.columns.map(c => cellMarkdown(row[c.key] || '')).join(' | ')} |`).join('\n')}\n` : '';
    const output = tool.calc ? `\n### 当前测算\n\n${calculate(tool.calc, record).rows.map(r => `- ${markdown(r.label)}：${markdown(r.value)}`).join('\n')}\n\n${markdown(calculate(tool.calc, record).note || '')}\n` : '';
    return `## ${tool.title}\n\n${tool.desc}\n\n来源：${tool.source.text}【${tool.source.level}】\n\n${tool.steps.map(step => `- ${step}`).join('\n')}\n\n${fields}${table}${output}\n保存版本：${record.history.length} 个（完整版本请使用 JSON 备份）\n${record.history.map(v => `- ${dateText(v.time)}：${markdown(v.note)}`).join('\n')}\n`;
  }
  function exportLibrary(format) {
    if (format === 'json') {
      download(JSON.stringify({ format: 'milestone-toolbox-backup-v1', exportedAt: new Date().toISOString(), library: store.state, stageCanvas: getLegacyRecords() }, null, 2), `创业工具库完整备份-${today()}.json`, 'application/json');
    } else {
      const recorded = tools.filter(t => store.state.tools[t.id]?.updatedAt || store.state.tools[t.id]?.history.length);
      download(`# 我的创业工具库\n\n导出日期：${today()}\n\n> 所有判断均为用户记录；估算不是事实，状态不代表成功。JSON 备份可恢复完整历史及基础作战画布。\n\n${recorded.length ? recorded.map(t => markdownForTool(t, store.get(t))).join('\n---\n\n') : '尚未填写工具记录。'}\n\n## 工具目录与资料边界\n\n${tools.map(t => `- ${t.title}【${t.source.level}】：${t.source.text}`).join('\n')}\n`, `创业工具库记录-${today()}.md`, 'text/markdown');
    }
    notify('文件已生成，正在下载；请妥善保存本地备份');
  }
  function compare(toolId, versionId) {
    const tool = tools.find(t => t.id === toolId);
    const record = store.get(tool);
    const version = record.history.find(v => v.id === versionId);
    if (!version) return;
    const differences = fieldsFor(tool).map(f => [f.label, version.values[f.key] || '', record.values[f.key] || '']).filter(([, before, now]) => before !== now);
    const summarizeRows = rows => rows.map((row, index) => `${index + 1}. ${tool.table.columns.map(c => `${c.label}：${row[c.key] || '（空）'}`).join('；')}`).join('\n');
    if (tool.table && JSON.stringify(version.rows) !== JSON.stringify(record.rows)) differences.push(['记录表', summarizeRows(version.rows), summarizeRows(record.rows)]);
    $('#tool-version-content').innerHTML = `<p>${escape(tool.title)} · ${escape(version.note)}<br>${escape(dateText(version.time))}</p><h3>与当前草稿不同的地方</h3>${differences.length ? `<div class="tool-table-scroll"><table class="version-comparison"><thead><tr><th>字段</th><th>该版本</th><th>当前草稿</th></tr></thead><tbody>${differences.map(([label, before, now]) => `<tr><th>${escape(label)}</th><td>${escape(before || '（空）')}</td><td>${escape(now || '（空）')}</td></tr>`).join('')}</tbody></table></div>` : '<p>与当前草稿内容一致。</p>'}<details><summary>查看该版本完整内容</summary><pre class="version-full-content">${escape(markdownForTool(tool, { ...version, history: [] }))}</pre></details>`;
    $('#tool-version-dialog').showModal();
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.toolOpen) { openTool(button.dataset.toolOpen); return; }
    if (button.dataset.toolStage) {
      clearFilters(); stage = button.dataset.toolStage; $('#tool-stage').value = stage; onOpen(); filterTools(); return;
    }
    if (!root.contains(button)) return;
    const tool = currentTool();
    const record = store.get(tool);
    if (button.hasAttribute('data-tool-clear')) clearFilters();
    if (button.dataset.tableMode) setTableMode(button.dataset.tableMode);
    if (button.dataset.canvasMode) { canvasMode = button.dataset.canvasMode; renderEditor(); $(`[data-canvas-mode="${canvasMode}"]`).focus({ preventScroll: true }); }
    if (button.hasAttribute('data-tool-add-row') && record.rows.length < MAX_ROWS) {
      record.rows.push({}); updateStatus(store.update(tool)); renderEditor(); renderDirectory();
      $(`[data-tool-row="${record.rows.length - 1}"]`)?.focus({ preventScroll: true });
    }
    if (button.dataset.toolRowRemove !== undefined) {
      const index = Number(button.dataset.toolRowRemove);
      if (!Number.isInteger(index) || !record.rows[index]) return;
      if (Object.values(record.rows[index]).some(v => String(v || '').trim()) && !window.confirm('移除这一行及其中的记录？建议先保存版本。')) return;
      record.rows.splice(index, 1); updateStatus(store.update(tool)); renderEditor(); renderDirectory();
      $('[data-tool-add-row]')?.focus({ preventScroll: true });
    }
    if (button.hasAttribute('data-tool-snapshot')) {
      try {
        const { saved: ok } = store.snapshot(tool, record.draftNote.trim());
        updateStatus(ok, '版本与草稿已保存在此浏览器'); renderEditor(); renderDirectory();
        notify(ok ? '本轮版本已保存' : '版本仅保留在当前会话，尚未写入浏览器；请立即备份');
      } catch (error) { notify(error.message); }
    }
    if (button.dataset.toolCompare) compare(button.dataset.toolCompare, button.dataset.versionId);
    if (button.dataset.toolRemoveVersion) {
      if (!window.confirm('仅移除这个历史版本？当前草稿不受影响。此操作无法撤销，请先导出 JSON 备份。')) return;
      try {
        const target = tools.find(t => t.id === button.dataset.toolRemoveVersion);
        const ok = store.removeVersion(target, button.dataset.versionId);
        updateStatus(ok); renderEditor(); renderDirectory();
        notify(ok ? '已移除指定历史版本，当前草稿未改变' : '已在当前会话移除，但未能写入浏览器，请备份');
      } catch (error) { notify(error.message); }
    }
    if (button.dataset.toolRestore) {
      if (!window.confirm('恢复这个版本？当前草稿会先自动保存为一个新版本，不会直接丢弃。')) return;
      try {
        const target = tools.find(t => t.id === button.dataset.toolRestore);
        const ok = store.restore(target, button.dataset.versionId);
        updateStatus(ok); renderEditor(); renderDirectory();
        notify(ok ? '已恢复，恢复前的草稿也已保存为版本' : '已在当前会话恢复，但未能写入浏览器，请立即备份');
      } catch (error) { notify(error.message); }
    }
    if (button.hasAttribute('data-tool-export')) {
      download(`# 我的工具记录\n\n${markdownForTool(tool, record)}`, `${tool.title.replace(/[\\/:*?"<>|]/g, '-')}-${today()}.md`, 'text/markdown'); notify('当前工具记录已生成，正在下载');
    }
    if (button.dataset.libraryExport) exportLibrary(button.dataset.libraryExport);
    if (button.hasAttribute('data-library-import')) $('#tool-import-file').click();
    if (button.hasAttribute('data-tool-dialog-close')) $('#tool-version-dialog').close();
  });
  root.addEventListener('input', event => {
    const input = event.target;
    if (input.id === 'tool-search') { query = input.value; filterTools(); return; }
    if (!input.matches('[data-tool-field], [data-tool-row], [data-version-note]')) return;
    const tool = currentTool();
    const record = store.get(tool);
    if (input.dataset.toolField) record.values[input.dataset.toolField] = input.value.slice(0, 5000);
    else if (input.hasAttribute('data-version-note')) record.draftNote = input.value.slice(0, 200);
    else record.rows[Number(input.dataset.toolRow)][input.dataset.toolColumn] = input.value.slice(0, 5000);
    updateStatus(store.update(tool));
    renderResults();
    // 不重绘表单，保留光标、中文输入法状态及表格滚动位置。
  });
  root.addEventListener('change', async event => {
    const input = event.target;
    if (input.id === 'tool-category') { category = input.value; filterTools(); }
    if (input.id === 'tool-stage') { stage = input.value; filterTools(); }
    if (input.id !== 'tool-import-file' || !input.files?.length) return;
    const file = input.files[0];
    try {
      if (file.size > 10_000_000) throw new Error('备份不能超过 10 MB');
      const raw = JSON.parse((await file.text()).replace(/^﻿/, ''));
      if (raw.format !== 'milestone-toolbox-backup-v1') throw new Error('不是本网站导出的工具库备份');
      const cleaned = cleanState(raw.library);
      let legacy;
      if (raw.stageCanvas !== undefined) {
        if (!Array.isArray(raw.stageCanvas) || raw.stageCanvas.length !== 5) throw new Error('基础作战画布结构不正确');
        legacy = raw.stageCanvas.map(record => {
          if (!record || !['待验证', '验证中', '证据支持'].includes(record.status) || typeof record.note !== 'string' || record.note.length > 5000) throw new Error('基础作战画布字段不正确');
          return { status: record.status, note: record.note };
        });
      }
      if (!window.confirm('导入将替换全部工具记录和备份包含的基础作战画布。请确认已备份当前数据，是否继续？')) return;
      const ok = store.replace(cleaned);
      const legacyOk = legacy ? importLegacyRecords(legacy) : true;
      updateStatus(ok && legacyOk, '备份已导入并保存'); renderDirectory(); renderEditor();
      notify(ok && legacyOk ? '备份已导入，记录和版本均已恢复' : '已导入当前会话，但未能完整写入浏览器，请立即重新备份');
    } catch (error) { notify(`未导入：${error.message}`); }
    finally { input.value = ''; }
  });
  $('#tool-version-dialog').addEventListener('click', event => {
    if (event.target !== $('#tool-version-dialog')) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
  });
  function restoreRoute(hash) {
    if (!hash.startsWith('#tool/')) return false;
    return openTool(hash.slice(6), false);
  }
  mobileQuery.addEventListener('change', event => {
    $('.tool-directory-shell').open = !event.matches;
    setTableMode(event.matches ? 'cards' : 'table');
  });
  $('.tool-directory-shell').addEventListener('toggle', event => {
    if (!mobileQuery.matches && !event.currentTarget.open) event.currentTarget.open = true;
  });
  window.addEventListener('hashchange', () => restoreRoute(location.hash));
  renderDirectory(); renderEditor();
  return { restoreRoute, get selectedId() { return selected; } };
}

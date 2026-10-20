import './design-system.css';
import './styles.css';
import './tools.css';
import { stages, methods, principles } from './data.js';
import { mountToolbox, stageToolLinks, stageToolIds } from './tools.js';
import { initializeTheme } from './theme.js';

const initialHash = location.hash;

const paths = {
  flag: '<path d="M5 21V4m0 0c4-4 8 4 14 0v10c-6 4-10-4-14 0"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  book: '<path d="M12 5v16m0-16C9 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-7-2-10 1Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  map: '<path d="m9 3-7 4v14l7-4 6 4 7-4V3l-7 4-6-4Zm0 0v14m6-10v14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9l10-6Zm-9 11 9 6 9-6M3 18l9 5 9-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  loop: '<path d="M20 7h-8a5 5 0 0 0 0 10h8M16 3l4 4-4 4M8 13l-4 4 4 4M4 17h8"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
};
const icon = (name, className = '') => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.flag}</svg>`;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'milestone-atlas-v1';
const validStatuses = ['待验证', '验证中', '证据支持'];
let records = stages.map(() => ({ status: '待验证', note: '' }));
let storageAvailable = true;
try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (Array.isArray(stored)) records = stages.map((_, i) => ({
    status: validStatuses.includes(stored[i]?.status) ? stored[i].status : '待验证',
    note: typeof stored[i]?.note === 'string' ? stored[i].note.slice(0, 5000) : '',
  }));
} catch { storageAvailable = false; }
let selected = Math.max(0, stages.findIndex((stage) => stage.id === location.hash.slice(1)));
let currentView = 'map';
let detailTab = 'actions';
let scene;
let toolbox;
let mapMode = '3d';

$('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#" aria-label="里程碑，回到创业地图"><span class="brand-symbol">${icon('flag')}</span><span class="brand-name">里程碑<span class="brand-divider"></span><span class="brand-sub">创业作战地图</span></span></a>
    <nav class="main-nav" aria-label="主要导航">
      <button class="nav-link active" data-view="map" aria-current="page">探索地图</button>
      <button class="nav-link" data-view="tools">验证工具箱</button>
      <button class="nav-link" data-view="canvas">作战画布</button>
    </nav>
    <div class="header-actions"><label class="theme-control"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor"/></svg><select id="theme-selector" aria-label="显示主题"><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select></label><button class="text-button source-button" aria-label="阅读说明">${icon('book')}<span>阅读说明</span></button><button class="export-button">${icon('download')}<span>导出画布</span></button></div>
  </header>
  <main id="content" tabindex="-1">
    <section class="page-view map-view" id="view-map" aria-label="创业地图">
      <div class="page-heading map-heading"><div><div class="eyebrow"><span class="tiny-line"></span> MILESTONE / 创业实践指南</div><h1>从一个想法，<span>到一门好生意。</span></h1><p>把创业拆成五个可以验证的判断。<br class="mobile-break">先找到关键问题，再迈出下一步。</p><div class="hero-actions"><button class="primary-button" data-view="canvas">打开我的作战画布 ${icon('arrow')}</button><button class="text-button" data-tool-open="canvas259">从 259 画布开始 ${icon('chevron')}</button></div></div><aside class="heading-guide" aria-label="使用路线"><span class="eyebrow">HOW TO USE / 三步开始</span><ol><li><span>01</span><div><strong>找到你的位置</strong><small>用地图判断，哪一关最不确定。</small></div></li><li><span>02</span><div><strong>选一次低成本验证</strong><small>用工具回答一个真正关键的问题。</small></div></li><li><span>03</span><div><strong>让证据决定下一步</strong><small>记录结果，允许前进，也允许回退。</small></div></li></ol></aside></div>
      <div class="atlas-layout">
        <div class="map-column">
          <div class="map-surface">
            <div class="map-topbar"><div class="map-type">${icon('compass')}<span>商业探索图</span><span class="map-edition">VOL. 01</span></div><div class="segmented" role="group" aria-label="地图展示方式"><button data-mode="3d" class="active" aria-pressed="true">3D 地形</button><button data-mode="text" aria-pressed="false">文字地图</button></div></div>
            <div id="scene-container" role="group" aria-label="五大里程碑 3D 示意图，可拖动旋转，使用下方按钮选择阶段">
              <div class="scene-loading"><span class="loading-orbit"></span><span>正在展开创业地图…</span></div>
              <div class="scene-labels">${stages.map((s, i) => `<button class="node-label ${i === selected ? 'selected' : ''}" data-stage="${i}" aria-label="${s.number} ${s.name}：${s.short}" aria-pressed="${i === selected}"><span class="node-number">${s.number}</span><span class="node-name">${s.name}</span><span class="node-mini">${s.short}</span></button>`).join('')}</div>
              <div class="map-tooltip" role="tooltip" hidden></div>
              <div class="map-coordinate"><span>N</span><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 28 32 20 25 12 32Z" fill="none" stroke="currentColor"/><path d="M20 4v21l-8 7Z" fill="currentColor"/></svg><small>EXPLORE / VALIDATE</small></div>
              <div class="scene-controls"><button data-scene="reset" aria-label="重置地图视角" title="重置视角">${icon('reset')}</button><span></span><button data-scene="in" aria-label="放大地图" title="放大">${icon('plus')}</button><button data-scene="out" aria-label="缩小地图" title="缩小">${icon('minus')}</button></div>
              <div class="scene-help">拖动旋转<span>·</span>滚轮缩放<span>·</span>点击探索</div>
            </div>
            <div id="text-map" hidden><div class="text-map-intro">先从左到右推理，也可以根据证据回退。</div><ol>${stages.map((s, i) => `<li><button data-stage="${i}"><span class="overview-number">${s.number}</span><span><strong>${s.name}</strong><small>${s.short}</small></span>${icon('chevron')}</button><p>${s.question}</p></li>`).join('')}</ol></div>
            <div class="map-bottomline"><span><i class="legend-line"></i>逻辑路径 <i class="legend-node"></i>当前探索</span><small>地形高度仅为示意，不代表难度或完成进度</small></div>
          </div>
          <nav class="stage-strip" aria-label="五大里程碑">${stages.map((s, i) => `<button class="stage-stop ${i === selected ? 'active' : ''}" data-stage="${i}" aria-pressed="${i === selected}"><span class="stop-number">${s.number}</span><span class="stop-copy"><strong>${s.name}</strong><small>${s.short}</small></span>${i < 4 ? '<span class="stop-connector">→</span>' : ''}</button>`).join('')}</nav>
          <div class="loop-note">${icon('loop')}<span><strong>允许回退，也鼓励重来。</strong> 提出假设 → 低成本验证 → 更新认知 → 再出发</span><button data-open="principles">三个验证原则 ${icon('arrow')}</button></div>
        </div>
        <aside class="detail-panel" aria-label="当前里程碑详情"></aside>
      </div>
    </section>
    <section class="page-view" id="view-tools" aria-label="验证工具箱" hidden>
      <div class="page-heading"><div><div class="eyebrow"><span class="tiny-line"></span> LESS COST. MORE LEARNING.</div><h1>让每一个判断，<span>都有工具可落地。</span></h1><p>从全局拆解到调研验证，从单元算账到持续复盘。先借认知，再做实验。</p></div><span class="section-index">THE TOOLBOX / 02</span></div>
      <div id="tool-workspace"></div>
      <details class="method-reference"><summary><span><span class="eyebrow">FIELD REFERENCE</span><strong>验证方法速览</strong><small>成本排序、FALSE 五种策略与三种测试范式</small></span>${icon('plus')}</summary><div class="method-reference-body">
      <div class="cost-ladder"><div class="ladder-heading">${icon('layers')}<div><span class="eyebrow">10 倍速验证公式</span><h2>先借认知，再做实验。</h2></div></div><div class="ladder-steps"><span><b>01</b>行业常识<small>专家访谈</small></span><i>〈</i><span><b>02</b>情报调研<small>研究已有事实</small></span><i>≪</i><span><b>03</b>精益实验<small>只测关键假设</small></span><i>≪</i><span><b>04</b>全量投入<small>信心足够再加码</small></span></div><p>这是获取认知的成本排序，不是固定数学倍数。访谈不能替代真实付费与交付证据。</p></div>
      <div class="section-label"><h2>FALSE · 五种低成本实验策略</h2><span>可以组合使用，不能越过合规与安全边界</span></div>
      <div class="method-grid">${methods.map((m) => `<article class="method-card"><div class="method-letter">${m.letter}<span>${m.en}</span></div><h3>${m.name}</h3><p>${m.text}</p><div class="method-example"><span>试一试</span>${m.example}</div><details><summary>证据边界 ${icon('plus')}</summary><p>${m.boundary}</p></details></article>`).join('')}</div>
      <div class="test-patterns"><div><span class="eyebrow">如何组织多轮实验</span><h2>不只要小步，也要走对顺序。</h2></div><article><span>01 / 灰度测试</span><p>投入太大？<br><strong>从小范围到大范围。</strong></p></article><article><span>02 / 组合测试</span><p>选项太多？<br><strong>先比较，再逐轮取舍。</strong></p></article><article><span>03 / 里程碑测试</span><p>假设相互依赖？<br><strong>先验证前置条件。</strong></p></article></div>
      </div></details>
      <div class="tools-return"><button class="primary-button" data-view="map">带着工具，回到地图 ${icon('arrow')}</button></div>
    </section>
    <section class="page-view" id="view-canvas" aria-label="创业作战画布" hidden>
      <div class="page-heading"><div><div class="eyebrow"><span class="tiny-line"></span> YOUR NEXT MOVE, IN FOCUS</div><h1>把想法写下来，<span>让证据带路。</span></h1><p>每轮只抓住一个关键问题。不是记任务，而是记录认知的变化。</p></div><span class="storage-badge">${icon('check')}<span id="save-status">仅保存在此浏览器</span></span></div>
      <div class="canvas-notice">${icon('info')}<p>这是你的本地作战画布，不会上传内容。“证据支持”由你根据真实结果判断，不代表项目必然成功。请定期导出备份。</p></div>
      <div class="canvas-table-wrap"><table class="canvas-table"><thead><tr><th>里程碑 / 核心问题</th><th>本轮状态</th><th>假设、证据与下一次验证</th><th><span class="sr-only">探索阶段</span></th></tr></thead><tbody>${stages.map((s, i) => `<tr><th scope="row"><span class="table-stage">${s.number}</span><strong>${s.name}</strong><p>${s.question}</p></th><td><label class="sr-only" for="status-${i}">${s.name}验证状态</label><select id="status-${i}" data-record="${i}">${validStatuses.map((v) => `<option>${v}</option>`).join('')}</select></td><td><label class="sr-only" for="note-${i}">${s.name}的假设与证据</label><textarea id="note-${i}" data-note="${i}" maxlength="5000" placeholder="我的假设：…&#10;已有证据：…&#10;下一次验证 / 预算 / 判定标准：…"></textarea></td><td><button class="icon-button" data-explore="${i}" aria-label="探索${s.name}">${icon('arrow')}</button></td></tr>`).join('')}</tbody></table></div>
      <div class="canvas-bottom"><span>支持 / 不支持 / 证据不足，都是有价值的结果。</span><button class="primary-button export-button">${icon('download')} 下载我的作战画布</button></div>
    </section>
  </main>
  <footer class="site-footer"><span class="footer-brand">MILESTONE<span>先全局预判，再重点执行。</span></span><button class="source-button">关于这张地图 ${icon('arrow')}</button><span class="footer-note">一份可反复使用的创业指南，不是成功的保证。</span></footer>
  <dialog id="info-dialog" aria-labelledby="dialog-title"><div class="dialog-top"><span class="eyebrow">MILESTONE / FIELD NOTES</span><button class="icon-button dialog-close" aria-label="关闭弹窗">${icon('close')}</button></div><div id="dialog-content"></div><button class="primary-button dialog-close">明白了，继续探索 ${icon('arrow')}</button></dialog>
  <div class="toast" role="status" aria-live="polite" hidden></div>
`;

function renderDetail() {
  const s = stages[selected];
  let content;
  if (detailTab === 'actions') {
    content = `<div class="action-list">${s.actions.map(([word, title, text]) => `<article class="action-item"><span class="action-word">${word}</span><div><h3>${title}</h3><p>${text}</p></div></article>`).join('')}</div><div class="deliverable">${icon('grid')}<div><span>带走一份交付物</span><p>${s.deliverable}</p></div></div>`;
  } else if (detailTab === 'gates') {
    content = `<p class="detail-intro">以下是实操归纳的判断信号，不是全行业通用的验收标准。</p><ul class="gate-list">${s.gates.map((g) => `<li>${icon('check')}<span>${g}</span></li>`).join('')}</ul><div class="retreat-note">${icon('loop')}<p>${s.retreat}</p></div>`;
  } else {
    content = `<p class="detail-intro">忙碌不等于前进。留意这些容易让项目偏离方向的判断。</p><ul class="trap-list">${s.traps.map((t, i) => `<li><span>0${i + 1}</span><p>${t}</p></li>`).join('')}</ul><div class="retreat-note">${icon('loop')}<p>${s.retreat}</p></div>`;
  }
  $('.detail-panel').innerHTML = `
    <div class="detail-header"><span class="detail-eyebrow">里程碑 ${s.number} <span>/ 05</span></span><span class="detail-icon">${icon('flag')}</span></div>
    <div class="detail-title"><span class="detail-en">${s.en}</span><h2>${s.name}<span>${s.short}</span></h2></div>
    <div class="core-question"><span>这一关，回答一个问题</span><h3>${s.question}</h3></div>
    <details class="stage-context"><summary>理解这一关</summary><p class="stage-description">${s.description}</p></details>
    <button class="tool-chip" data-tool-open="${stageToolIds[s.id][0]}">${icon('target')}<span class="tool-chip-copy"><span>核心工具 · ${s.tool}</span><small>${s.toolDetail}</small></span>${icon('chevron')}</button>
    <div class="detail-tabs" role="tablist" aria-label="阶段内容">${[['actions', '行动指南'], ['gates', '过关信号'], ['traps', '常见陷阱']].map(([id, name]) => `<button role="tab" id="tab-${id}" aria-selected="${detailTab === id}" aria-controls="detail-content" tabindex="${detailTab === id ? 0 : -1}" data-detail="${id}" class="${detailTab === id ? 'active' : ''}">${name}</button>`).join('')}</div>
    <div class="detail-content" id="detail-content" role="tabpanel" aria-labelledby="tab-${detailTab}">${content}</div>
    ${stageToolLinks(s.id)}
    <div class="detail-source">${s.supplement ? icon('info') : icon('book')}<span>${s.source}</span></div>
    <div class="detail-navigation"><button data-step="-1" ${selected === 0 ? 'disabled' : ''} aria-label="上一个里程碑">← 上一步</button><span>${s.number} <i>/</i> 05</span><button data-step="1" ${selected === 4 ? 'disabled' : ''} aria-label="下一个里程碑">下一步 →</button></div>
  `;
}

function selectStage(index, { focus = false } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= stages.length) return;
  selected = index;
  const stage = stages[index];
  history.replaceState(null, '', `${location.pathname}${location.search}#${stage.id}`);
  $$('[data-stage]').forEach((button) => {
    const active = Number(button.dataset.stage) === index;
    button.classList.toggle('active', active);
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  scene?.setSelected(index);
  renderDetail();
  if (focus) $('.detail-panel h2').scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function showView(view) {
  if (!['map', 'tools', 'canvas'].includes(view)) return;
  currentView = view;
  $$('.page-view').forEach((section) => { section.hidden = section.id !== `view-${view}`; });
  $$('.main-nav [data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  if (view === 'map') {
    scene?.resize();
    history.replaceState(null, '', `#${stages[selected].id}`);
  } else if (view === 'tools' && toolbox) {
    history.replaceState(null, '', `#tool/${toolbox.selectedId}`);
  } else if (view === 'canvas') {
    history.replaceState(null, '', '#canvas');
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function setMapMode(mode) {
  mapMode = mode;
  $('#scene-container').hidden = mode !== '3d';
  $('#text-map').hidden = mode !== 'text';
  $$('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
  if (mode === '3d') scene?.resize();
}

function toast(text) {
  const element = $('.toast');
  element.textContent = text;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, 3500);
}

function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    storageAvailable = true;
    $('#save-status').textContent = '已保存在此浏览器';
    return true;
  } catch {
    storageAvailable = false;
    $('#save-status').textContent = '未能保存，请导出备份';
    return false;
  }
}

function exportCanvas() {
  const date = new Date().toLocaleDateString('sv-SE');
  const markdown = `# 我的创业作战画布\n\n导出日期：${date}\n\n> 状态为使用者自行判断，不代表项目必然成功。\n\n${stages.map((s, i) => `## ${s.number} ${s.name} — ${records[i].status}\n\n核心问题：${s.question}\n\n核心工具：${s.tool}\n\n### 我的假设、证据与下一次验证\n\n${records[i].note || '（尚未记录）'}\n\n### 行动指南\n\n${s.actions.map(([, title, text]) => `- **${title}**：${text}`).join('\n')}\n\n### 建议过关信号\n\n${s.gates.map((g) => `- ${g}`).join('\n')}\n\n来源：${s.source}\n`).join('\n---\n\n')}\n\n## 来源边界\n\n地图基于《里程碑》一堂五步法。现有两份材料正文到第七章，增长与壁垒执行建议是基于总论与案例的实操补充。交付物与过关信号为整理归纳。\n`;
  const url = URL.createObjectURL(new Blob(['﻿', markdown], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `创业作战画布-${date}.md`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('作战画布已生成，正在下载');
}

function openDialog(kind) {
  const content = kind === 'principles'
    ? `<h2 id="dialog-title">先抓住最重要的假设。</h2><p class="dialog-lead">创业不是同时解答所有问题，而是有顺序地消除关键不确定性。</p>${principles.map(([title, text], i) => `<div class="principle"><span>0${i + 1}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join('')}<div class="dialog-callout">风险越高，步子越小。每一笔投入，都应该对应一个值得回答的问题。</div>`
    : `<h2 id="dialog-title">一张地图，不是成功公式。</h2><p class="dialog-lead">基于许楚《里程碑》中的“一堂五步法”，将商业判断转化为可探索、可验证的路径。</p><h3>怎样使用</h3><p>点击地形、地图标签或下方阶段，查看行动指南、过关信号与常见陷阱。拖动可旋转，滚轮可缩放，也可用键盘操作按钮。文字地图提供同等内容入口。</p><h3>材料与来源边界</h3><p>两份材料的正文覆盖认知篇、验证方法，以及需求、解决方案、商业模式章节，结束于第七章。增长和壁垒依据前文总论、案例及目录建立框架，具体执行建议为实操补充，不是第八、九章原文复述。</p><p>工具库中“材料 01／02”分别对应《里程碑01.pdf》《里程碑02.pdf》的 Markdown 提取，行号不是 PDF 页码。原文框架、实操归纳、正文缺失、OCR 待核与仅有提及均单独标记，不以通用工作表冒充缺失原文。</p><p>交付物、过关信号及作战画布为整理归纳，不是统一验收标准。地图的高度、距离不编码难度、时间或真实项目进度。</p><h3>隐私与安全</h3><p>画布记录只存于当前浏览器本地存储，不会上传。清理浏览器数据可能丢失记录，请导出备份。小规模测试不免除合同、税务、行业许可、产品安全与数据保护要求。</p>`;
  $('#dialog-content').innerHTML = content;
  $('#info-dialog').showModal();
}

function showTooltip(index, x, y) {
  const tip = $('.map-tooltip');
  if (index < 0) { tip.hidden = true; return; }
  const s = stages[index];
  tip.textContent = `${s.number} ${s.name} · ${s.short}`;
  tip.hidden = false;
  const container = $('#scene-container');
  tip.style.left = `${Math.min(Math.max(12, x + 16), container.clientWidth - tip.offsetWidth - 12)}px`;
  tip.style.top = `${Math.min(Math.max(8, y + 16), container.clientHeight - tip.offsetHeight - 8)}px`;
}

function handleSceneError() {
  scene?.dispose();
  scene = undefined;
  $('.scene-loading').hidden = true;
  $('#scene-container canvas')?.remove();
  setMapMode('text');
  toast('3D 暂不可用，已切换为完整文字地图');
  $('[data-mode="3d"]').disabled = true;
  $('[data-mode="3d"]').title = '浏览器暂不支持 WebGL，请使用文字地图';
}

// Event delegation keeps stage controls working when detail content changes.
document.addEventListener('click', (event) => {
  const button = event.target.closest('button, .brand');
  if (!button) return;
  if (button.matches('.brand')) { event.preventDefault(); showView('map'); scene?.reset(); return; }
  if (button.dataset.stage !== undefined) selectStage(Number(button.dataset.stage));
  if (button.dataset.view) showView(button.dataset.view);
  if (button.dataset.mode) setMapMode(button.dataset.mode);
  if (button.dataset.detail) {
    detailTab = button.dataset.detail;
    renderDetail();
    $(`[data-detail="${detailTab}"]`).focus({ preventScroll: true });
  }
  if (button.dataset.step) {
    const direction = Number(button.dataset.step);
    selectStage(selected + direction);
    const target = $(`[data-step="${direction}"]`);
    if (!target.disabled) target.focus({ preventScroll: true });
    else $(`[data-detail="${detailTab}"]`).focus({ preventScroll: true });
  }
  if (button.dataset.explore !== undefined) { showView('map'); selectStage(Number(button.dataset.explore)); }
  if (button.dataset.scene === 'reset') scene?.reset();
  if (button.dataset.scene === 'in') scene?.zoom(1);
  if (button.dataset.scene === 'out') scene?.zoom(-1);
  if (button.matches('.export-button')) exportCanvas();
  if (button.matches('.source-button')) openDialog('source');
  if (button.dataset.open) openDialog(button.dataset.open);
  if (button.matches('.dialog-close')) $('#info-dialog').close();
});

document.addEventListener('keydown', (event) => {
  if (event.target.matches('[role="tab"][data-detail]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const tabs = ['actions', 'gates', 'traps'];
    let next = tabs.indexOf(detailTab);
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 2;
    else next = (next + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3;
    detailTab = tabs[next];
    renderDetail();
    $(`[data-detail="${detailTab}"]`).focus({ preventScroll: true });
  }
  if (event.target.matches('.stage-stop') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 4 : Math.min(4, Math.max(0, selected + (event.key === 'ArrowRight' ? 1 : -1)));
    selectStage(next);
    $(`.stage-stop[data-stage="${next}"]`).focus({ preventScroll: true });
  }
});

$('#info-dialog').addEventListener('click', (event) => {
  if (event.target === $('#info-dialog')) {
    const r = event.target.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close();
  }
});

$$('[data-record]').forEach((select, i) => {
  select.value = records[i].status;
  select.addEventListener('change', () => { records[i].status = select.value; saveRecords(); });
});
$$('[data-note]').forEach((textarea, i) => {
  textarea.value = records[i].note;
  textarea.addEventListener('input', () => { records[i].note = textarea.value; saveRecords(); });
});
if (!storageAvailable) $('#save-status').textContent = '本地存储不可用，请导出备份';
window.addEventListener('hashchange', () => {
  const index = stages.findIndex((s) => s.id === location.hash.slice(1));
  if (index >= 0) { showView('map'); selectStage(index); }
  else if (location.hash === '#canvas') showView('canvas');
});
$('#scene-container').addEventListener('scene-error', handleSceneError);
const theme = initializeTheme(mode => scene?.setTheme(mode), toast);
selectStage(selected);
toolbox = mountToolbox({
  onOpen: () => showView('tools'),
  notify: toast,
  getLegacyRecords: () => structuredClone(records),
  importLegacyRecords: (imported) => {
    records = imported;
    $$('[data-record]').forEach((select, i) => { select.value = records[i].status; });
    $$('[data-note]').forEach((textarea, i) => { textarea.value = records[i].note; });
    return saveRecords();
  },
});
toolbox.restoreRoute(initialHash);
if (initialHash === '#canvas') showView('canvas');
async function initializeScene() {
  try {
    const { StartupScene } = await import('./scene.js');
    scene = new StartupScene($('#scene-container'), $$('.node-label'), selectStage, showTooltip);
    scene.setSelected(selected);
    $('.scene-loading').hidden = true;
  } catch (error) {
    console.warn('3D map unavailable; the text map remains accessible.', error);
    handleSceneError();
  }
}
void initializeScene();
window.addEventListener('pagehide', (event) => { if (!event.persisted) scene?.dispose(); });

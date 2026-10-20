const LIMIT = 1e15;
export const formatNumber = (value) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);

export function readNumber(value, { signed = false, percent = false } = {}) {
  if (typeof value !== 'string' && typeof value !== 'number') return { error: '待填写' };
  if (String(value).trim() === '') return { error: '待填写' };
  const number = Number(value);
  if (!Number.isFinite(number)) return { error: '请输入有限数字' };
  if (Math.abs(number) > LIMIT) return { error: '绝对值不能超过 10¹⁵，请统一调整计量单位' };
  if (!signed && number < 0) return { error: '不能为负数' };
  if (percent && number > 100) return { error: '必须在 0～100% 之间' };
  return { value: number };
}

function inputs(object, definitions) {
  const values = {};
  for (const [key, label, options] of definitions) {
    const result = readNumber(object[key], options);
    if (result.error) return { error: `${label}：${result.error}` };
    values[key] = result.value;
  }
  return { values };
}

function result(label, value, suffix = '') {
  if (!Number.isFinite(value) || Math.abs(value) > LIMIT) return { label, value: '结果超出计算范围，请统一调整计量单位', error: true };
  return { label, value: `${formatNumber(value)}${suffix}` };
}
const message = (label, value) => ({ label, value });
const invalid = (label, error) => ({ label, value: error, error: !error.endsWith('待填写') });
function evaluate(label, data, definitions, calculation) {
  const parsed = inputs(data, definitions);
  return parsed.error ? invalid(label, parsed.error) : result(label, calculation(parsed.values));
}
function payback(investment, cash) {
  if (cash <= 0) return '无法用非正净现金流计算回本期';
  const periods = investment / cash;
  return Number.isFinite(periods) && periods <= LIMIT ? `${formatNumber(periods)} 个核算周期（简化静态值）` : '回本期超出计算范围';
}

export function calculate(kind, record) {
  const d = record.values || {};
  const rows = record.rows || [];
  if (kind === 'market') return {
    rows: [
      evaluate('第三方报告 · 市场年收入', d, [['report', '报告规模']], v => v.report),
      evaluate('自顶向下 · 市场年收入', d, [['base', '上层市场规模'], ['segment', '细分比例', { percent: true }], ['channel', '渠道比例', { percent: true }]], v => v.base * v.segment / 100 * v.channel / 100),
      evaluate('自底向上 · 市场年收入', d, [['customers', '目标客户数'], ['frequency', '年购买次数'], ['price', '单次收入']], v => v.customers * v.frequency * v.price),
      evaluate('对标业务 · 调整后年收入', d, [['peer', '可比业务收入'], ['adjust', '调整系数']], v => v.peer * v.adjust),
    ], note: '四个估计不自动取平均；先检查年份、地区、币种与收入定义是否一致，差异是继续调研的线索。',
  };
  if (kind === 'tam') {
    const parsed = inputs(d, [['customers', '客户数'], ['frequency', '年购买次数'], ['price', '单次收入'], ['service', '可服务比例', { percent: true }], ['obtain', '可获得份额', { percent: true }]]);
    if (parsed.error) return { rows: [invalid('TAM / SAM / SOM', parsed.error)] };
    const v = parsed.values;
    const tam = v.customers * v.frequency * v.price;
    const sam = tam * v.service / 100;
    return { rows: [result('TAM · 潜在年收入空间', tam), result('SAM · 可服务年收入空间', sam), result('SOM · 可获得年收入估计', sam * v.obtain / 100)], note: '这是同一收入口径下的情景估计，不是 GMV、利润、市场预测或保底收入。SOM 比例是用户假设，不是工具预测的胜率。' };
  }
  if (kind === 'value') return { rows: [evaluate('同一自定义量表下的用户价值差额', d, [['new', '新体验', { signed: true }], ['old', '旧体验', { signed: true }], ['switching', '替换成本']], v => v.new - v.old - v.switching)], note: '概念性比较，不是经过验证的货币价值，也不能跨不同量表直接比较。' };
  if (kind === 'quadrants') return {
    rows: rows.filter(r => r.name).map(r => {
      const hints = { '高频强': '关注高频交付、稳定质量与留存', '低频强': '关注信任、单次价值与低频获客', '高频弱': '关注习惯、触发与替换阻力', '低频弱': '关注细分场景与成本约束' };
      return message(r.name, hints[`${r.frequency}${r.rigidity}`] || '待判断频次和刚性');
    }), note: '类型帮助组织经营问题，不自动排序机会好坏；以上提示为实操归纳。',
  };
  if (kind === 'rates') return {
    rows: rows.filter(row => row.metric).map(row => {
      const parsed = inputs(row, [['numerator', '符合条件的数量'], ['denominator', '对应基数']]);
      if (parsed.error) return invalid(row.metric, parsed.error);
      const { numerator, denominator } = parsed.values;
      if (denominator === 0) return message(row.metric, '基数为 0，比例未定义');
      if (numerator > denominator) return invalid(row.metric, '分子不能超过同口径基数，请检查人群与事件定义');
      return result(row.metric, numerator / denominator * 100, '%');
    }), note: '只计算同口径计数比例，不给出统一及格线；退款率等指标并非越高越好，样本量和选择偏差也需要检查。',
  };
  if (kind === 'unit') {
    const ledger = rows.filter(r => Object.values(r).some(v => String(v || '').trim()));
    if (!ledger.length) return { rows: [message('单元测算', '待填写收入成本项目；空白不当作 0')] };
    const sums = { 收入: 0, 变动成本: 0, 固定成本: 0, 一次性投入: 0 };
    for (const [index, row] of ledger.entries()) {
      if (!row.name?.trim() || !Object.hasOwn(sums, row.type)) return { rows: [invalid('项目检查', `第 ${index + 1} 行：请填写名称并选择类别`)] };
      const value = readNumber(row.amount);
      if (value.error) return { rows: [invalid('项目检查', `${row.name}：${value.error}`)] };
      sums[row.type] += value.value;
    }
    if (Object.values(sums).some(sum => !Number.isFinite(sum) || sum > LIMIT)) return { rows: [invalid('分类合计', '合计金额超出计算范围，请统一调整计量单位')] };
    const revenue = sums['收入'];
    const cost = sums['变动成本'] + sums['固定成本'];
    const profit = revenue - cost;
    const output = [result('周期收入', revenue), result('周期经营成本', cost), result('周期经营利润（按已列成本）', profit), result('一次性投入（不直接扣作周期成本）', sums['一次性投入'])];
    output.push(revenue > 0 && Math.abs(profit) <= LIMIT ? result('经营利润率', profit / revenue * 100, '%') : message('经营利润率', '收入为 0 或结果超出范围，不计算比例'));
    if (String(d.cash || '').trim()) {
      const cash = readNumber(d.cash, { signed: true });
      output.push(cash.error ? invalid('简化回本期', cash.error) : message('简化回本期', payback(sums['一次性投入'], cash.value)));
    } else output.push(message('简化回本期', '待填写同周期实测净现金流；不用利润代替现金'));
    return { rows: output, note: '仅汇总你列出的项目，不证明成本完整、单元成立或可以复制。完整成本还应检查税费、折旧、资金成本、售后、坏账及组织分摊。回本测算假定每周期现金流不变，不计折现与新增投入。' };
  }
  if (kind === 'scenarios') {
    const output = [];
    for (const row of rows) {
      const name = row.scenario || '未命名情景';
      const parsed = inputs(row, [['revenue', '收入'], ['variable', '变动成本'], ['fixed', '固定成本'], ['investment', '一次性投入'], ['cash', '净现金流', { signed: true }]]);
      if (parsed.error) { output.push(invalid(name, parsed.error)); continue; }
      const v = parsed.values;
      output.push(result(`${name} · 周期经营利润`, v.revenue - v.variable - v.fixed));
      output.push(message(`${name} · 简化回本期`, payback(v.investment, v.cash)));
    }
    return { rows: output, note: '利润 = 收入 − 变动成本 − 固定成本。回本期以一次性投入 ÷ 同周期净现金流作静态示意，不扣折现、不预测后续投入；三种情景均由你独立填写，不是自动预测。' };
  }
  if (kind === 'dynamic') return {
    rows: rows.map((row, index) => evaluate(`${row.scenario || `阶段 ${index + 1}`} · 公司周期利润估计`, row, [['units', '单元数量'], ['revenue', '单元收入'], ['cost', '单元成本'], ['hq', '未分摊总部成本']], v => v.units * (v.revenue - v.cost) - v.hq)),
    note: '总利润估计 = 单元数量 ×（单元收入 − 单元完整成本）− 未分摊总部成本。不重复分摊；忽略时点差异时不能据此预测现金安全。',
  };
  if (kind === 'profit') {
    const parsed = inputs(d, [['unit', '单元利润', { signed: true }], ['company', '公司利润', { signed: true }]]);
    if (parsed.error) return { rows: [invalid('盈利诊断', parsed.error)] };
    const { unit, company } = parsed.values;
    let hint;
    if (unit === 0 || company === 0) hint = '存在盈亏平衡项：应单独检查边界、口径和未来变化，不直接归入盈利或亏损。';
    else if (unit > 0 && company > 0) hint = '账面均为正：还要检验成本完整、现金流与可复制性，不自动证明可持续。';
    else if (unit > 0) hint = '单元为正、公司为负：检查总部费用、孵化投入、分摊及扩张节奏。';
    else if (company < 0) hint = '单元与公司均为负：先核对账目与原因，再考虑修正、回退或停止复制。';
    else hint = '单元为负、公司为正：检查其他业务、一次性收益、核算口径与未履约义务；不能据此证明该单元成立。';
    return { rows: [message('诊断提示', hint)], note: '这是基于你填写的两个利润数的描述性检查，不是财务审计或投资建议。' };
  }
  return { rows: [] };
}

import { strToU8, zipSync } from 'fflate';
import productSkill from '../skills/product-clarity/SKILL.md?raw';
import businessSkill from '../skills/business-teardown/SKILL.md?raw';

const repository = 'https://github.com/AsherEthan/milestone-startup-atlas';
const skills = [
  {
    id: 'product-clarity',
    title: '产品梳理',
    subtitle: '从自己的想法出发',
    description: '适合只有一个想法、正在做原型，或想重新梳理已有产品的人。通过逐轮追问，找到当前最值得验证的判断。',
    output: '产品作战卡 · 关键假设 · 本轮实验卡',
    example: '我想帮助小餐饮店减少每日备货浪费，目前只有想法。请先帮我澄清用户和需求，每轮最多问三个问题。',
    content: productSkill,
  },
  {
    id: 'business-teardown',
    title: '成熟商业拆解',
    subtitle: '从成熟企业学习',
    description: '适合研究成熟企业、品牌或具体业务线的人。沿需求、产品内核、单元经济、增长与壁垒拆解，区分事实和推断。',
    output: '商业拆解卡 · 证据台账 · 有前提的可迁移经验',
    example: '请拆解一家连锁咖啡品牌在中国的门店业务，重点理解单店模型与复购。先和我确认品牌、时期和资料范围。',
    content: businessSkill,
  },
];

export function mountSkillGuide({ icon }) {
  const section = document.querySelector('#view-skills');
  section.innerHTML = `
    <div class="page-heading skill-guide-heading"><div><div class="eyebrow"><span class="tiny-line"></span> TAKE THE METHOD WITH YOU</div><h1>把方法带走，<span>在你的 AI 助手中使用。</span></h1><p>这里是 Skill 使用指南，不是在线分析工具。选择一份指引，复制到 AI 聊天，或下载后安装；产品与商业分析在你选择的工具中进行。</p></div><a class="secondary-button skill-star" href="${repository}" target="_blank" rel="noopener noreferrer">${icon('star')} GitHub Star ${icon('arrow')}</a></div>
    <div class="skill-guide-cards">${skills.map((skill, i) => `
      <article class="skill-guide-card" id="skill-${skill.id}" aria-labelledby="title-${skill.id}">
        <span class="eyebrow">0${i + 1} / ${skill.subtitle}</span><h2 id="title-${skill.id}">${skill.title}</h2><p>${skill.description}</p>
        <div class="skill-output"><span>你会得到</span><strong>${skill.output}</strong></div>
        <div class="skill-actions"><button class="primary-button" data-skill-download="${skill.id}">${icon('download')} 下载 ${skill.id}.zip</button><button class="secondary-button" data-skill-copy="${skill.id}">${icon('layers')} 复制完整指引</button></div>
        <p class="skill-feedback" data-skill-feedback="${skill.id}" role="status" aria-live="polite" hidden></p>
        <details class="skill-preview"><summary>预览 SKILL.md</summary><label class="sr-only" for="content-${skill.id}">${skill.title}完整 Skill 指引</label><textarea id="content-${skill.id}" readonly spellcheck="false"></textarea></details>
        <a class="skill-source" href="${repository}/tree/main/skills/${skill.id}" target="_blank" rel="noopener noreferrer">在 GitHub 查看源文件 ${icon('arrow')}</a>
      </article>`).join('')}</div>
    <div class="skill-how-heading"><span class="eyebrow">HOW TO USE / 选一种方式开始</span><h2>下载之后，怎么用？</h2><p>不需要在这个网页填写项目，也不需要向本站提供 API Key。</p></div>
    <div class="skill-how-grid">
      <article class="skill-how"><span class="skill-method">方式一 · 不用安装</span><h3>粘贴到普通 AI 聊天</h3><ol><li>选择上方一份 Skill，点击<strong>复制完整指引</strong>。</li><li>打开你常用的 AI 助手，新建对话，粘贴并发送完整指引。</li><li>再发送你的产品想法或要拆解的企业，按 AI 的追问补充资料。</li></ol><p class="skill-note">这是把 Skill 当作对话指引使用，不等于在该平台安装了原生技能；效果取决于所用模型和工具。</p></article>
      <article class="skill-how"><span class="skill-method">方式二 · 支持原生 Skill 的工具</span><h3>以 Claude Code 为例</h3><ol><li>下载需要的 <code>Skill ZIP</code> 并解压，包内已包含技能目录和 <code>SKILL.md</code>。</li><li>把含 <code>SKILL.md</code> 的文件夹复制到当前项目的 <code>.claude/skills/</code> 下，不要再套一层同名目录；只装一份也可以：</li></ol><pre><code>.claude/skills/
├── product-clarity/
│   └── SKILL.md
└── business-teardown/
    └── SKILL.md</code></pre><p>个人全局安装可使用 <code>~/.claude/skills/</code>。安装后，在 Claude Code 中输入对应命令，再描述你的需求：</p><div class="skill-commands"><code>/product-clarity</code><code>/business-teardown</code></div><p class="skill-note">其他支持 Skill 的工具，请按各自安装规范操作。下载文件本身不会自动安装或运行。</p><a class="skill-source" href="https://code.claude.com/docs/en/skills" target="_blank" rel="noopener noreferrer">查看 Claude Code 官方安装说明 ${icon('arrow')}</a></article>
    </div>
    <div class="skill-examples"><h2>第一句话，可以这样说</h2>${skills.map(skill => `<div><h3>${skill.title}</h3><p>${skill.example}</p></div>`).join('')}</div>
    <p class="skill-privacy">本站不调用 AI，也不读取或附带你的画布与工具库记录。请在外部 AI 工具中自行提供必要资料，并确认其数据政策；不要分享未经授权的客户或内部信息。</p>
    <aside class="skill-support"><div><h2>觉得有用，给项目一颗 Star。</h2><p>在 GitHub 登录后，点击仓库右上角的 Star，支持这份地图与 Skill 的持续完善。使用和下载不需要先 Star。</p></div><a class="primary-button" href="${repository}" target="_blank" rel="noopener noreferrer">${icon('star')} 去 GitHub 点 Star ${icon('arrow')}</a></aside>
    <div class="tools-return"><button class="secondary-button" data-view="map">回到创业地图 ${icon('arrow')}</button></div>
  `;

  skills.forEach(skill => {
    const card = section.querySelector(`#skill-${skill.id}`);
    const preview = card.querySelector('textarea');
    preview.value = skill.content;
    const feedback = card.querySelector('[data-skill-feedback]');
    function notify(message) {
      feedback.textContent = message;
      feedback.hidden = false;
    }
    card.querySelector('[data-skill-copy]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(skill.content);
        notify('完整指引已复制。请在你的 AI 助手中新建对话、粘贴，再介绍项目。');
      } catch {
        card.querySelector('details').open = true;
        preview.focus();
        preview.select();
        notify('剪贴板不可用，已选中完整指引，请手动复制。');
      }
    });
    card.querySelector('[data-skill-download]').addEventListener('click', () => {
      const archive = zipSync({ [`${skill.id}/SKILL.md`]: strToU8(skill.content) });
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${skill.id}.zip`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`${skill.id}.zip 已生成，内含 ${skill.id}/SKILL.md。解压后按下方步骤安装。`);
    });
  });
}

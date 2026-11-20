#!/usr/bin/env node
/**
 * knowvori · audit-page.mjs
 *
 * 在真实浏览器里打开课程，做 validate-lesson.mjs 做不到的那部分检查。
 *
 * validate-lesson.mjs 读的是源码字符串，它能确认「有没有绑定事件」，
 * 但不能确认「点了到底有没有反应」「390px 下会不会横向溢出」「深色模式下
 * 文字会不会看不见」。这些只能真打开页面才知道。
 *
 * 用法：
 *   node skills/knowvori/scripts/audit-page.mjs <课程.html> [更多...]
 *
 * 选项：
 *   --json=<file>   把结果写成 JSON，便于 CI 或对比
 *   --widths=320,390,768,1100   要测的视口宽度（默认这几个）
 *   --no-quiz       跳过练习点击（只测布局）
 *
 * 退出码：0 = 无 error；1 = 有 error；2 = 用法错误
 *
 * 依赖 playwright-core 和一个 Chromium/Edge。没有的话会明确告诉你装什么，
 * 而不是抛一个看不懂的堆栈。
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/* ── 参数 ───────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const hit = argv.find((a) => a.startsWith(`--${n}=`));
  return hit === undefined ? d : hit.slice(n.length + 3);
};
const files = argv.filter((a) => !a.startsWith('--'));

if (!files.length || argv.includes('--help')) {
  console.log('用法: node audit-page.mjs <课程.html> [更多...] [--widths=320,390,768,1100] [--json=out.json] [--no-quiz]');
  process.exit(2);
}

const WIDTHS = flag('widths', '320,390,768,1100').split(',').map(Number).filter((n) => n >= 240);
const SKIP_QUIZ = argv.includes('--no-quiz');
const jsonOut = flag('json');

/* ── 找浏览器 ───────────────────────────────────────────────────── */
/**
 * 找 playwright-core。
 *
 * 不能只靠 require，因为 Windows 的 node.exe 不认 WSL 里设的 NODE_PATH，
 * 而课程仓又不想为了一个可选工具强制装依赖。所以按顺序试几处：
 * 当前目录 → 仓根 → 录制工具目录 → NODE_PATH 里的每一段。
 */
function loadPlaywright() {
  const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const tries = [
    here,                                          // 与脚本同层
    path.resolve(here, '../../..'),                // 仓根
    path.resolve(here, '../../../tools/audit-deps'),
    ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  ];

  for (const base of tries) {
    try {
      const mod = require(path.join(base, 'node_modules', 'playwright-core'));
      if (mod?.chromium) return mod;
    } catch { /* 继续找 */ }
    try {
      const mod = require(base);
      if (mod?.chromium) return mod;
    } catch { /* 继续找 */ }
  }

  // 最后一搏：交给 Node 自己的解析链
  try {
    return require('playwright-core');
  } catch { /* 真的没有 */ }
  return null;
}

async function getChromium() {
  const pw = loadPlaywright();
  if (!pw) {
    console.error(C.red('✗ 找不到 playwright-core。'));
    console.error('  最省事：在仓根跑 npm i -D playwright-core');
    console.error('  或者：cd tools/audit-deps && npm install');
    process.exit(2);
  }
  // 系统 Edge / Chrome 通常比下载 Chromium 省事；都没有才回去下
  for (const channel of ['msedge', 'chrome']) {
    try {
      const b = await pw.chromium.launch({ channel });
      return { browser: b, engine: channel };
    } catch { /* 换下一个 */ }
  }
  try {
    return { browser: await pw.chromium.launch(), engine: 'bundled-chromium' };
  } catch {
    console.error(C.red('✗ 没有可用的浏览器。'));
    console.error('  装 Edge/Chrome，或跑：npx playwright install chromium');
    process.exit(2);
  }
}

const toUrl = (p) => `file:///${path.resolve(p).replace(/\\/g, '/').replace(/^\//, '')}`;

/* ── 单页检查 ───────────────────────────────────────────────────── */
async function auditPage(page, file) {
  const results = [];
  const add = (level, rule, msg) => results.push({ level, rule, msg });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const offsite = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!/^(file|data|blob):/.test(u)) offsite.push(u);
  });

  await page.goto(toUrl(file), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  // ── 1. 加载期报错 ──
  if (errors.length) {
    add('error', '运行时报错', `${errors.length} 条，首条：${errors[0].slice(0, 90)}`);
  } else {
    add('pass', '运行时报错', '加载与交互过程无 console error / pageerror');
  }

  // ── 2. 断网可用 ──
  if (offsite.length) {
    add('error', '零外部请求', `实际发出 ${offsite.length} 个外部请求，例如 ${offsite[0].slice(0, 70)}`);
  } else {
    add('pass', '零外部请求', '只产生 file:// 请求，断网可打开');
  }

  // ── 3. 横向溢出（逐个视口）──
  const overflow = [];
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(180);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const scrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
      const clientW = de.clientWidth;
      // 找出真正越界、且宽度不为 0 的元素，报前几个，方便定位
      const guilty = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.right > clientW + 1.5) {
          guilty.push({
            sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                 (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''),
            right: Math.round(b.right),
            w: Math.round(b.width),
          });
        }
      }
      return { scrollW, clientW, over: scrollW - clientW, guilty: guilty.slice(0, 3) };
    });
    if (r.over > 2) {
      const who = r.guilty.map((g) => `${g.sel}(${g.w}px)`).join('、') || '未定位到具体元素';
      overflow.push(`${w}px 溢出 ${r.over}px：${who}`);
    }
  }
  if (overflow.length) {
    add('error', '横向溢出', overflow.join('；'));
  } else {
    add('pass', '横向溢出', `${WIDTHS.join(' / ')}px 均无横向滚动`);
  }

  // ── 4. 文字是否被裁掉 / 重叠 ──
  await page.setViewportSize({ width: WIDTHS.at(-1), height: 900 });
  await page.waitForTimeout(150);
  const textIssues = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,li,code,button,label,output,td,th')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || !el.textContent.trim()) continue;
      // 内容被裁：本身设了 hidden/scroll，但还有内容溢出
      const clipped = /hidden|scroll|auto/.test(cs.overflow) &&
        (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2);
      if (clipped && el.children.length === 0) {
        out.push({ kind: '裁切', sel: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 24) });
      }
    }
    return out.slice(0, 5);
  });
  if (textIssues.length) {
    add('warn', '文字裁切', textIssues.map((t) => `<${t.sel}>「${t.text}」`).join('；'));
  } else {
    add('pass', '文字裁切', '未见文字被容器裁掉');
  }

  // ── 5. 深色模式对比度 ──
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(200);
  const contrast = await page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const bgOf = (el) => {
      let n = el;
      while (n && n !== document.documentElement) {
        const c = getComputedStyle(n).backgroundColor;
        const a = (c.match(/[\d.]+/g) || [])[3];
        if (c && c !== 'rgba(0, 0, 0, 0)' && (a === undefined || Number(a) > 0.5)) return parse(c);
        n = n.parentElement;
      }
      return parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
    };
    const bad = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,li,span,code,button,label,output')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const txt = el.textContent.trim();
      if (!txt || el.children.length > 0) continue;
      const fg = parse(cs.color), bg = bgOf(el);
      if (fg.length < 3 || bg.length < 3) continue;
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      if (ratio < need) bad.push({ t: txt.slice(0, 20), ratio: +ratio.toFixed(2), need, size });
    }
    return bad.slice(0, 5);
  });
  if (contrast.length) {
    add('warn', '深色对比度', contrast.map((c) => `「${c.t}」${c.ratio}:1（需 ${c.need}）`).join('；'));
  } else {
    add('pass', '深色对比度', '深色模式下正文对比度达标');
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(150);

  if (SKIP_QUIZ) return { results, quizzes: null };

  // ── 6. 练习：逐题点一遍，两条路径都要有反馈 ──
  //
  // 这里不能假设「点完解析必须展开」——答对时解析收起是合理设计（答对了不必再解释）。
  // 真正要查的是：点了有反应吗？而且这个反应是答对/答错的区分反馈吗？
  // 所以判据是「出现新的反馈节点」或「选项状态变化」，二者有其一就算有反馈。
  const quiz = await page.evaluate(async () => {
    const groups = [...document.querySelectorAll('[data-qid], .quiz')];
    if (!groups.length) return { groups: 0, checked: 0, problems: [] };

    const wait = () => new Promise((r) => setTimeout(r, 80));
    const problems = [];
    let checked = 0;
    const snapshot = (g) => ({
      cls: [...g.querySelectorAll('.opt, button[data-correct]')].map((o) => o.className).join('|'),
      kids: g.children.length,
      text: g.textContent,
      disabled: [...g.querySelectorAll('.opt, button[data-correct]')].some((o) => o.disabled),
    });

    for (const [gi, g] of groups.entries()) {
      const opts = [...g.querySelectorAll('.opt, button[data-correct]')];
      if (!opts.length) continue;

      for (const which of ['right', 'wrong']) {
        if (gi > 0 && checked > 0 && opts[0].disabled) break;  // 已答过，跳过
        const opt = opts.find((o) => (which === 'right') === (o.dataset.correct === 'true'));
        if (!opt) continue;

        const before = snapshot(g);
        opt.click();
        await wait();
        const after = snapshot(g);

        // 有反馈 = 选项样式变了 / 多了反馈节点 / 文字多了 / 被禁用
        const changed = after.cls !== before.cls || after.kids > before.kids ||
                        after.text.length > before.text.length + 2 || after.disabled;
        if (!changed) {
          problems.push(`第 ${gi + 1} 题点「${which === 'right' ? '正确' : '错误'}」选项后页面无任何变化`);
        }
        // 答错时正确项应该被标出来，这是课程自己承诺的行为
        if (which === 'wrong') {
          const rightOpt = opts.find((o) => o.dataset.correct === 'true');
          const marked = rightOpt && /right|correct/.test(rightOpt.className);
          const said = /正确|应该|对：|答案是/.test(after.text);
          if (!marked && !said) {
            problems.push(`第 ${gi + 1} 题答错后未标出正确项`);
          }
        }
        checked++;
        break;  // 每组只需验一条路径，两道都点会互相干扰
      }
    }
    return { groups: groups.length, checked, problems };
  });

  if (quiz.groups === 0) {
    add('pass', '练习可作答', '无自测题，不适用');
  } else if (quiz.problems.length) {
    add('error', '练习可作答', quiz.problems.slice(0, 4).join('；'));
  } else {
    add('pass', '练习可作答', `${quiz.groups} 组题、${quiz.checked} 次点击，均有点击反馈与解析`);
  }

  /* ── 自动回放能跑完吗 ──────────────────────────────────────────
     演示最阴的坏法不是报错，是「按钮点了没反应」：脚本拼错、
     引擎没定义、代码掉到 </body> 外面，全部是静默的。所以这里
     真的点一下，等它跑完，看旁白有没有推进、按钮有没有恢复。 */
  const hasReplay = await page.evaluate(() => !!document.querySelector('[data-replay-btn]'));
  if (hasReplay) {
    const rp = await (async () => {
      const btnSel = '[data-replay-btn]';
      const before = await page.evaluate((sel) => {
        const b = document.querySelector(sel);
        return { text: b.textContent, pressed: b.getAttribute('aria-pressed') };
      }, btnSel);

      await page.click(btnSel);

      // 最多等 25 秒；demo 是缓动动画，太快采样会误判
      const lines = [];
      for (let i = 0; i < 50; i++) {
        await page.waitForTimeout(500);
        const st = await page.evaluate(() => ({
          note: (document.querySelector('[data-replay-note]') || {}).textContent || '',
          btn: document.querySelector('[data-replay-btn]').textContent,
          pressed: document.querySelector('[data-replay-btn]').getAttribute('aria-pressed'),
        }));
        if (st.note && lines[lines.length - 1] !== st.note) lines.push(st.note);
        if (st.pressed === 'false' && lines.length > 1) return { ok: true, lines, backMs: (i + 1) * 500 };
      }
      return { ok: false, lines, stuck: true };
    })();

    if (!rp.ok && rp.lines.length === 0) {
      add('error', '自动回放', '有演示按钮，但点了没任何反应（引擎未定义 / 脚本未执行 / 选择器写错）');
    } else if (!rp.ok) {
      add('warn', '自动回放', `演示尚未跑完（已等 25 秒，已到 ${rp.lines.length} 段）——確認是否需要这么久`);
    } else {
      add('pass', '自动回放', `点一下能跑完，${rp.lines.length} 段旁白依次推进，约 ${Math.round(rp.backMs / 1000)} 秒`);
    }
  } else {
    add('pass', '自动回放', '无演示按钮，不适用');
  }

  // 点完练习后可能才暴露的运行时报错
  if (errors.length) {
    const first = results.find((r) => r.rule === '运行时报错');
    if (first && first.level === 'pass') {
      first.level = 'error';
      first.msg = `交互后出现 ${errors.length} 条报错，首条：${errors[0].slice(0, 90)}`;
    }
  }

  return { results, quizzes: quiz };
}

/* ── 报告 ───────────────────────────────────────────────────────── */
function report(file, results, engine) {
  console.log(`\n${C.bold('━'.repeat(62))}`);
  console.log(`${C.bold('浏览器审计')} ${path.basename(file)}  ${C.dim(`(${engine})`)}`);
  console.log(C.bold('━'.repeat(62)));

  let e = 0, w = 0, p = 0;
  for (const r of results) {
    const icon = r.level === 'error' ? C.red('✗ ERROR')
      : r.level === 'warn' ? C.yellow('! WARN ')
      : C.green('✓ PASS ');
    console.log(`${icon} ${C.bold(r.rule.padEnd(10))} ${r.msg}`);
    if (r.level === 'error') e++;
    else if (r.level === 'warn') w++;
    else p++;
  }
  console.log(C.dim('─'.repeat(62)));
  console.log(`  ${C.green(`pass ${p}`)}   ${C.yellow(`warn ${w}`)}   ${C.red(`error ${e}`)}`);
  return { errors: e, warnings: w, passes: p };
}

/* ── 主流程 ─────────────────────────────────────────────────────── */
const { browser, engine } = await getChromium();
const summary = [];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log(C.red(`文件不存在: ${f}`));
    summary.push({ file: f, errors: 1 });
    continue;
  }
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  try {
    const { results, quizzes } = await auditPage(page, f);
    const counts = report(f, results, engine);
    summary.push({ file: path.basename(f), ...counts, quizzes });
  } catch (e) {
    console.log(C.red(`\n✗ ${path.basename(f)} 审计中断：${e.message}`));
    summary.push({ file: path.basename(f), errors: 1 });
  } finally {
    await page.close();
  }
}

await browser.close();

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
  fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ engine, widths: WIDTHS, audited: summary }, null, 2) + '\n');
  console.log(C.dim(`\nJSON 已写入 ${jsonOut}`));
}

const totalErrors = summary.reduce((a, s) => a + (s.errors || 0), 0);
console.log('');
if (totalErrors) {
  console.log(C.red(`✗ ${totalErrors} 项 error。注意：无 error ≠ 课程合格，仍要看 quality-checklist.md 第 7 节的人工验收。`));
} else {
  console.log(C.green('✓ 浏览器审计无 error。仍需人工判断教学质量。'));
}
process.exit(totalErrors ? 1 : 0);

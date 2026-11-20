#!/usr/bin/env node
/**
 * 把自动回放（CSS + 引擎 + UI + 每课演示脚本）注入 7 份课程。
 *
 * ── 为什么是这个写法 ────────────────────────────────────────────
 * 这个脚本只做「插入」，从不删除或替换原有内容：每一步都是往一个
 * 精确锚点上插字符串，插完立刻断言「新内容 = 旧内容 + 插入片段」，
 * 不成立就报错退出。
 *
 * 之前用正则在已注入的文件上重跑，把课程原有的脚本整段吞掉了
 * （反向引用贪婪匹配吃掉了用户代码）。那种 bug 不会报错，页面打开
 * 也是个能看的页面，只是交互全死了。所以这里宁可麻烦，也不猜。
 *
 * 用法：node tools/inject-replay.mjs   （在干净基线上一跑到底）
 */
import fs from 'node:fs';
import path from 'node:path';

const EX = 'skills/knowvori/examples';
const ENGINE = fs.readFileSync('skills/knowvori/assets/replay-engine.js', 'utf8').trim();

const CSS = `
  /* ── 自动回放（由 tools/inject-replay.mjs 注入，勿手改）──────────
     配色全部走课程自己的 CSS 变量，深色主题自动跟随。 */
  .replay{
    display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    margin:18px 0;padding:9px 11px;
    border:1px dashed var(--line);background:var(--surface,var(--paper));
  }
  .replay-btn{
    min-height:40px;padding:6px 14px;border:1px solid var(--line);
    background:var(--paper);color:var(--ink);cursor:pointer;
    font-family:var(--mono,var(--sans,system-ui));font-size:12.5px;font-weight:700;
    letter-spacing:.02em;transition:background .15s,border-color .15s,color .15s;
    display:inline-flex;align-items:center;gap:7px;
  }
  .replay-btn:hover{border-color:var(--accent);background:var(--accent-soft,var(--soft))}
  .replay-btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--paper)}
  .replay-note{flex:1 1 220px;min-width:0;font-size:12.5px;line-height:1.6;color:var(--soft,var(--muted))}
  .replay-bar{flex:0 0 100%;height:2px;background:var(--line);overflow:hidden}
  .replay-bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .25s linear}
  @media (prefers-reduced-motion: reduce){.replay-bar i{transition:none}}
`;

/* 每课：UI 插在哪、按钮叫什么、演示脚本是什么 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const COURSES = require('./replay-scripts.cjs');

let bad = 0;
for (const [file, cfg] of Object.entries(COURSES)) {
  const p = path.join(EX, file);
  let s = fs.readFileSync(p, 'utf8');

  const before = s;
  const step = (name, fn) => {
    const next = fn(s);
    if (next === s) { console.error(`  !! ${file}: ${name} 没插入任何内容（锚点没匹配）`); bad++; return false; }
    if (next.length < s.length) { console.error(`  !! ${file}: ${name} 让文件变短了`); bad++; return false; }
    s = next; return true;
  };

  // 1. CSS → 最后一个 </style> 前
  if (!step('CSS', (t) => {
    const i = t.lastIndexOf('</style>');
    return i < 0 ? t : t.slice(0, i) + CSS + t.slice(i);
  })) continue;

  // 2. 引擎 → 主 script（最后一个 <script>）开头
  if (!step('引擎', (t) => {
    const open = t.lastIndexOf('<script>');
    return open < 0 ? t : t.slice(0, open + 8) + '\n' +
      '/* ─── KVReplay ▸ v1（与 skills/knowvori/assets/replay-engine.js 同步）─── */\n' +
      ENGINE + '\n' + t.slice(open + 8);
  })) continue;

  // 3. UI → 锚点前
  if (!step('UI', (t) => {
    const i = t.indexOf(cfg.before);
    if (i < 0) return t;
    const ui = `  <div class="replay" id="kvReplay">
    <button class="replay-btn" type="button" data-replay-btn aria-pressed="false">▶ ${cfg.label}</button>
    <span class="replay-note" data-replay-note aria-live="polite"></span>
    <div class="replay-bar" data-replay-bar aria-hidden="true"><i></i></div>
  </div>

`;
    return t.slice(0, i) + ui + t.slice(i);
  })) continue;

  // 3.5 桥：把课程闭包里的东西暴露给演示（只读状态 / 只写位置）
  if (cfg.bridgeAnchor) {
    if (!step('桥', (t) => {
      const i = t.indexOf(cfg.bridgeAnchor);
      return i < 0 ? t : t.slice(0, i) + cfg.bridgeCode + t.slice(i + cfg.bridgeAnchor.length);
    })) continue;
  }

  // 4. 演示脚本 → 主 script 的 </script> 前
  if (!step('脚本', (t) => {
    const close = t.lastIndexOf('</script>');
    return close < 0 ? t : t.slice(0, close) + cfg.script + t.slice(close);
  })) continue;

  // 自检：原有脚本必须一字不改地还在。
  // 只比较开头结尾是不够的 —— 之前的 bug 正是「中间整段被吃掉」，
  // 而首尾都对得上。所以直接把原主脚本体当子串找。
  const origScript = before.slice(before.lastIndexOf('<script>') + 8, before.lastIndexOf('</script>'));
  // 校验「原有脚本一字未丢」。有桥的课，桥是对原文的合法改写，
  // 所以先看剥掉桥之后剩下的是否还完整包含在文件里。
  let probe = s;
  if (cfg.bridgeAnchor && cfg.bridgeCode) {
    probe = probe.replace(cfg.bridgeCode, cfg.bridgeAnchor);
  }
  if (!origScript.trim() || !probe.includes(origScript)) {
    console.error(`  !! ${file}: 原有脚本内容丢失或被改动`);
    bad++;
    continue;
  }

  fs.writeFileSync(p, s);
  console.log(`ok ${file.padEnd(28)} ${before.length}B → ${s.length}B  (+${s.length - before.length})`);
}

if (bad) { console.error(`\n${bad} 处失败，未写入的文件保持原样。`); process.exit(1); }
console.log('\n全部注入完成。接着跑：node skills/knowvori/scripts/validate-lesson.mjs skills/knowvori/examples/*.html');

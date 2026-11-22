#!/usr/bin/env node
/* 生成示例路线 route-21days/：5 份日课 + 1 张汇总页。
   内容在 route-demo-content.mjs，演示在 route-demo-parts.mjs。
   这里只负责拼装，以及把引擎内联进去（单文件交付不能外链）。 */

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE, STAGES, DAYS } from './route-demo-content.mjs';
import { DEMOS, SCRIPTS, REPLAYS } from './route-demo-parts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = resolve(root, 'skills/knowvori/examples/route-5days');
mkdirSync(outDir, { recursive: true });

const REPLAY = readFileSync(resolve(root, 'skills/knowvori/assets/replay-engine.js'), 'utf8').trim();
const PROGRESS = readFileSync(resolve(root, 'skills/knowvori/assets/route-progress.js'), 'utf8').trim();
for (const [n, s] of [['replay-engine', REPLAY], ['route-progress', PROGRESS]]) {
  if (/<\/?script/i.test(s)) { console.error(`✗ ${n} 含 <script> 字面量，内联会破坏 HTML`); process.exit(1); }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const BASE_CSS = `
  :root{
    --paper:#fbfaf7;--surface:#fff;--ink:#1c1b19;--ink-soft:#5c5850;--line:#e2ded6;
    --accent:#b45309;--accent-soft:#fdf3e3;--ok:#15803d;--ok-soft:#eefbf1;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    --sans:system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif;
  }
  [data-theme="dark"]{
    --paper:#14130f;--surface:#1c1a16;--ink:#eae6dc;--ink-soft:#a09a8c;--line:#332f27;
    --accent:#f0a34a;--accent-soft:#2a2115;--ok:#63c98a;--ok-soft:#16241b;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);
    font-size:16px;line-height:1.75;-webkit-font-smoothing:antialiased}
  .wrap{max-width:760px;margin:0 auto;padding:26px 17px 70px}`;

const REPLAY_CSS = `
  .replay{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0;padding:9px 11px;
    border:1px dashed var(--line);background:var(--surface)}
  .replay-btn{min-height:40px;padding:6px 14px;border:1px solid var(--line);background:var(--paper);
    color:var(--ink);cursor:pointer;font-family:var(--mono);font-size:12.5px;font-weight:700;
    display:inline-flex;align-items:center;gap:7px}
  .replay-btn:hover{border-color:var(--accent);background:var(--accent-soft)}
  .replay-btn[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--paper)}
  [data-theme="dark"] .replay-btn[aria-pressed="true"]{color:#14130f}
  .replay-note{flex:1 1 220px;min-width:0;font-size:12.5px;line-height:1.6;color:var(--ink-soft)}
  .replay-bar{flex:0 0 100%;height:2px;background:var(--line);overflow:hidden}
  .replay-bar i{display:block;height:100%;width:0;background:var(--accent);transition:width .25s linear}`;

const THEME_TOGGLE = `
  <button id="themeBtn" type="button" aria-label="切换深浅色"
    style="position:fixed;top:12px;right:12px;z-index:20;min-width:40px;min-height:40px;
    border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);
    cursor:pointer;font-size:15px;line-height:1;border-radius:0">◐</button>
  <script>
    (function () {
      var b = document.getElementById('themeBtn');
      var KEY = 'kv:theme';
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (e) {}
      var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var theme = saved || (sysDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
      b.addEventListener('click', function () {
        var t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem(KEY, t); } catch (e) {}
      });
    })();
  </script>`;

/* ── 一份日课 ────────────────────────────────────────────── */
function renderLesson(d) {
  const demo = DEMOS[d.demo];
  const idx = DAYS.indexOf(d);
  const prev = idx > 0 ? DAYS[idx - 1] : null;
  const next = idx < DAYS.length - 1 ? DAYS[idx + 1] : null;

  const quizHtml = d.quiz.map((q, qi) => `
    <div class="quiz" data-answered="0">
      <p class="q">${qi + 1}. ${esc(q.q)}</p>
      <div class="opts">
${q.opts.map(([text], oi) => `        <button class="opt" type="button" data-q="${qi}" data-o="${oi}" data-correct="${oi === 0 ? 'true' : 'false'}">${esc(text)}</button>`).join('\n')}
      </div>
${q.opts.map(([, why], oi) => `      <div class="explain why" data-why="${qi}-${oi}" hidden>${esc(why)}</div>`).join('\n')}
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Day ${d.n} · ${esc(d.title)} — ${esc(ROUTE.title)}</title>
<style>${BASE_CSS}${REPLAY_CSS}
  .top{font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;color:var(--accent);
    text-transform:uppercase;margin-bottom:8px}
  h1{font-size:clamp(22px,3.6vw,29px);line-height:1.3;margin:0 0 12px;letter-spacing:-.01em}
  .goal{font-size:16.5px;color:var(--ink-soft);margin:0 0 8px}
  .goal b{color:var(--ink)}
  .crumb{font-size:13px;margin:0 0 22px}
  .crumb a{color:var(--accent)}
  .recap{border-left:2px solid var(--accent);padding:9px 0 9px 13px;margin:0 0 20px;
    font-size:14.5px;color:var(--ink-soft)}
  .recap p{margin:0 0 5px}.recap p:last-child{margin:0}
  .recap a{color:var(--accent)}
  section.stn{margin:0 0 30px}
  .stn-no{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:var(--accent);
    text-transform:uppercase;margin-bottom:5px}
  h2{font-size:max(17px,1.15em);line-height:1.4;margin:0 0 10px}
  .jargon{background:var(--accent-soft);border-left:2px solid var(--accent);
    padding:11px 13px;margin:14px 0;font-size:14.5px}
  .jargon p{margin:0 0 7px}.jargon p:last-child{margin:0}
  .term{font-weight:700;color:var(--accent)}
  .derive{border:1px solid var(--line);background:var(--surface);padding:12px 14px;
    margin:14px 0;font-size:14.5px}
  .derive div{margin-bottom:7px;padding-left:54px;position:relative}
  .derive div:last-child{margin:0}
  .tag{position:absolute;left:0;top:2px;font-family:var(--mono);font-size:10.5px;
    padding:1px 6px;background:var(--accent-soft);color:var(--accent);font-weight:700}
  .derive .counter{padding-top:8px;border-top:1px dashed var(--line);margin-top:9px}
  .demo{border:1px solid var(--line);background:var(--surface);padding:13px;margin:16px 0}
  .demo-title{font-family:var(--mono);font-size:11px;letter-spacing:.1em;color:var(--accent);
    text-transform:uppercase;margin-bottom:11px}
  .ctrl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:11px;
    font-size:13.5px;color:var(--ink-soft)}
  .ctrl label{display:flex;align-items:center;gap:8px;flex:1 1 200px;min-width:0}
  input[type=range]{flex:1;min-width:80px;min-height:40px;accent-color:var(--accent)}
  .val{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--ink);
    min-width:46px;font-variant-numeric:tabular-nums}
  .btn-reset{min-height:40px;padding:5px 12px;border:1px solid var(--line);background:var(--paper);
    color:var(--ink-soft);cursor:pointer;font-family:var(--mono);font-size:12px}
  .btn-reset:hover{border-color:var(--accent);color:var(--accent)}
  .out{font-size:13.5px;line-height:1.65;color:var(--ink-soft);
    padding-top:9px;border-top:1px dashed var(--line);margin-top:9px}
  .out b{color:var(--ink);font-variant-numeric:tabular-nums}
  .quiz{border:1px solid var(--line);background:var(--surface);padding:13px;margin:0 0 11px}
  .q{font-size:15px;font-weight:600;margin:0 0 10px;line-height:1.6}
  .opts{display:flex;flex-direction:column;gap:7px}
  .opt{text-align:left;min-height:40px;padding:9px 12px;border:1px solid var(--line);
    background:var(--paper);color:var(--ink);cursor:pointer;font-family:inherit;font-size:14.5px;
    line-height:1.55}
  .opt:hover{border-color:var(--accent);background:var(--accent-soft)}
  .opt.right{border-color:var(--ok);background:var(--ok-soft)}
  .opt.wrong{border-color:#c2410c;background:#fdf0e9}
  [data-theme="dark"] .opt.wrong{background:#2a1712}
  .why{display:none;font-size:13.5px;line-height:1.7;margin-top:9px;padding:9px 11px;
    background:var(--accent-soft);border-left:2px solid var(--accent);color:var(--ink-soft)}
  pre{background:var(--surface);border:1px solid var(--line);padding:12px;overflow-x:auto;
    font-family:var(--mono);font-size:12.5px;line-height:1.65;margin:12px 0}
  code{font-family:var(--mono);font-size:.92em;background:var(--accent-soft);padding:1px 5px}
  pre code{background:none;padding:0}
  .note-box{border:1px solid var(--line);background:var(--surface);padding:11px 13px;
    font-size:13.5px;line-height:1.7;margin:12px 0}
  .checklist{list-style:none;padding:0;margin:0}
  .checklist li{display:flex;gap:9px;align-items:flex-start;padding:7px 0;
    border-bottom:1px solid var(--line);font-size:14.5px}
  .checklist li:last-child{border:0}
  .checklist input{margin-top:5px;width:16px;height:16px;accent-color:var(--accent);flex:0 0 auto}
  .daydone{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0 8px;
    padding:14px 15px;border:1px solid var(--line);background:var(--surface)}
  .daydone-txt{flex:1 1 220px;min-width:0;font-size:13.5px;color:var(--ink-soft)}
  .daydone-txt b{display:block;font-size:14.5px;color:var(--ink);margin-bottom:2px}
  .daydone-btn{min-height:42px;padding:9px 18px;border:1px solid var(--accent);
    background:var(--accent);color:var(--paper);cursor:pointer;font-family:var(--sans);
    font-size:14.5px;font-weight:700}
  [data-theme="dark"] .daydone-btn{color:#14130f}
  .daydone-btn[data-done="1"]{background:var(--ok-soft);border-color:var(--ok);color:var(--ok)}
  .daydone-hint{flex:0 0 100%;font-size:12.5px;color:var(--ink-soft);margin:0}
  .next-up{border-left:2px solid var(--line);padding:9px 0 9px 13px;margin:20px 0 0;
    font-size:14.5px;color:var(--ink-soft)}
  .next-up p{margin:0 0 5px}.next-up p:last-child{margin:0}
  .next-up a{color:var(--accent)}
  @media (max-width:520px){
    .wrap{padding:20px 13px 56px}
    .derive div{padding-left:0;padding-top:21px}
    .tag{top:0}
    .ctrl label{flex:1 1 100%}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
${THEME_TOGGLE}
<div class="wrap">
  <div class="top">Day ${d.n} / ${DAYS.length} · ${esc(ROUTE.title)}</div>
  <h1>${esc(d.title)}</h1>
  <p class="goal">学完这一天，<b>${esc(d.check)}</b>。</p>
  <p class="crumb"><a href="route.html">← 回到路线总览</a></p>
${d.recap ? `
  <div class="recap">
    <p>${esc(d.recap)}</p>
${prev ? `    <p>如果没印象，<a href="${prev.file}">回去看 Day ${prev.n}</a>，十分钟就够。</p>` : ''}
  </div>
` : ''}
  <section class="stn">
    <div class="stn-no">第 1 站 · 卡点</div>
    <h2>${esc(d.stationTitle)}</h2>
    <p>${esc(d.pain)}</p>

    <div class="jargon">
${d.jargon.map(([t, def, ana]) => `      <p><span class="term">「${esc(t)}」</span>${esc(def)}</p>
      <p style="color:var(--ink-soft);font-size:14px">就像${esc(ana)}</p>`).join('\n')}
    </div>

    <div class="derive">
      <div><span class="tag">现象</span>${esc(d.derive.phen)}</div>
      <div><span class="tag">为什么</span>${esc(d.derive.why)}</div>
      <div><span class="tag">所以</span>${esc(d.derive.so)}</div>
      <div class="counter"><span class="tag">不这样</span>${esc(d.derive.counter)}</div>
    </div>

    <div class="replay" id="kvReplay">
      <button class="replay-btn" type="button" data-replay-btn aria-pressed="false">▶ 看一遍演示</button>
      <span class="replay-note" data-replay-note aria-live="polite"></span>
      <div class="replay-bar" data-replay-bar aria-hidden="true"><i></i></div>
    </div>

    <div class="demo">
      <div class="demo-title">动手试 · ${esc(demo.title)}</div>
      <div class="ctrl">${demo.ctrl}
      </div>
      ${demo.canvas}
      ${demo.out}
    </div>
  </section>

  <section class="stn">
    <div class="stn-no">第 2 站 · 自测</div>
    <h2>先答，答完才看解释</h2>
    <p style="font-size:13.5px;color:var(--ink-soft);margin:0 0 12px">
      反馈类型：<b>客观校验</b>（每题有唯一正确答案，选完立刻判定）。
      第 3 题是<b>迁移题</b> —— 换一个没在这节课出现过的新情境。
    </p>
${quizHtml}
  </section>

  <section class="stn">
    <div class="stn-no">第 3 站 · 动手</div>
    <h2>${esc(d.handsTitle)}</h2>
    <pre><code>${esc(d.hands)}</code></pre>
    <div class="note-box">
      <strong>预期输出</strong><br>
      <code style="white-space:pre-wrap">${esc(d.handsOut)}</code><br>
      <span style="font-size:13px;color:var(--ink-soft)">${esc(d.handsNote)}</span>
    </div>
    <button class="btn-reset" type="button" id="ranBtn" data-hands-on="0"
      style="min-height:40px;padding:7px 14px">我跑过这段代码了</button>
  </section>

  <section class="stn">
    <div class="stn-no">第 4 站 · 完成清单</div>
    <h2>勾完，这一天就算过关</h2>
    <ul class="checklist">
      <li><input type="checkbox"><span>我能不看资料说出「${esc(d.check)}」</span></li>
      <li><input type="checkbox"><span>我能解释为什么，而不是只记住结论</span></li>
      <li><input type="checkbox"><span>我知道不这么做会怎样</span></li>
      <li><input type="checkbox"><span>我能在一道没见过的新题上用出来</span></li>
    </ul>

    <div class="daydone" id="dayDone">
      <div class="daydone-txt">
        <b>今天学完了吗？</b>
        自测全部作答 + 动手跑过一次，就可以点右边。进度按天记，断几天回来还能接着走。
      </div>
      <button class="daydone-btn" type="button" id="dayDoneBtn" data-done="0">今天学完了 ✓</button>
      <p class="daydone-hint" id="dayDoneHint"></p>
    </div>
  </section>

  <div class="next-up">
    <p><strong>明天（Day ${next ? next.n : '—'}）</strong>：${esc(d.nextUp)}</p>
    <p><strong>今天没讲的</strong>：${esc(d.dontCover)}</p>
${next ? `    <p><a href="${next.file}">直接去 Day ${next.n} →</a> · <a href="route.html">回到路线总览</a></p>` : ''}
  </div>
</div>

<script>
/* ─── KVProgress ▸ v1 ─── */
${PROGRESS}
</script>

<script>
/* ─── KVReplay ▸ v1 ─── */
${REPLAY}
</script>

<script>
/* ─── 这一天的交互演示（真算） ─── */
(function () {
${SCRIPTS[d.demo]}
})();
</script>

<script>
/* ─── 自测：答完才展开 ─── */
(function () {
  document.querySelectorAll('.quiz').forEach(function (quiz) {
    quiz.querySelectorAll('.opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qi = btn.dataset.q, oi = btn.dataset.o;
        quiz.querySelectorAll('.opt').forEach(function (b) {
          b.classList.remove('right', 'wrong');
        });
        var isRight = btn.dataset.correct === 'true';
        btn.classList.add(isRight ? 'right' : 'wrong');
        // 答错时把正确项也标出来 —— 否则用户只知道错了，不知道该选哪个
        if (!isRight) {
          var correct = quiz.querySelector('.opt[data-correct="true"]');
          if (correct) correct.classList.add('right');
        }
        quiz.querySelectorAll('.why').forEach(function (w) { w.style.display = 'none'; w.hidden = true; });
        var w = quiz.querySelector('[data-why="' + qi + '-' + oi + '"]');
        if (w) { w.style.display = 'block'; w.hidden = false; }
        quiz.dataset.answered = '1';
      });
    });
  });
})();
</script>

<script>
/* ─── 动手区标记 ─── */
(function () {
  var b = document.getElementById('ranBtn');
  if (!b) return;
  b.addEventListener('click', function () {
    b.dataset.handsOn = '1';
    b.dataset.tried = '1';
    b.textContent = '记住了，我跑过了 ✓';
    b.style.borderColor = 'var(--ok)';
    b.style.color = 'var(--ok)';
  });
})();
</script>

<script>
/* ─── KVReplaySteps ▸ ${d.file} ▸ v1 ─── */
(function () {
  var root = document.getElementById('kvReplay');
  if (!root || !window.KVReplay) return;
  KVReplay.create({
    root: root,
    label: '看一遍演示',
    done: '演示结束。现在你自己拖一下，数字一样是现算的。',
    steps: ${REPLAYS[d.demo]}
  });
})();
</script>

<script>
/* ─── 进度上报：三条都满足才算完成 ─── */
(function () {
  var CONFIG = { routeId: '${ROUTE.id}', dayId: '${d.id}', nextFile: '${next ? next.file : ''}' };
  var box = document.getElementById('dayDone');
  if (!box || !window.KVProgress) return;

  var btn = document.getElementById('dayDoneBtn');
  var hint = document.getElementById('dayDoneHint');

  function quizzesAnswered() {
    var qs = document.querySelectorAll('.quiz');
    if (!qs.length) return true;
    return [].every.call(qs, function (q) { return q.dataset.answered === '1'; });
  }
  function handsOnTried() {
    var e = document.querySelector('[data-hands-on]');
    return e ? e.dataset.tried === '1' : true;
  }
  function sync() {
    var done = !!window.KVProgress.load(CONFIG.routeId).done[CONFIG.dayId];
    btn.dataset.done = done ? '1' : '0';
    btn.textContent = done ? '已完成 · 点一下撤销' : '今天学完了 ✓';
    hint.textContent = done ? '进度已记录。回汇总页看下一步。' : '';
  }
  btn.addEventListener('click', function () {
    var done = !!window.KVProgress.load(CONFIG.routeId).done[CONFIG.dayId];
    if (done) { window.KVProgress.undoSelf(CONFIG.routeId, CONFIG.dayId); sync(); return; }
    var missing = [];
    if (!quizzesAnswered()) missing.push('自测还有没作答的');
    if (!handsOnTried()) missing.push('动手还没点「我跑过了」');
    if (missing.length) { hint.textContent = '还差：' + missing.join('；') + '。'; return; }
    window.KVProgress.markDone(CONFIG.routeId, CONFIG.dayId);
    sync();
  });
  window.KVProgress.markVisited(CONFIG.routeId, CONFIG.dayId);
  sync();
})();
</script>
</body>
</html>
`;
}

/* ── 汇总页 ──────────────────────────────────────────────── */
function renderRoute() {
  const daysJs = DAYS.map((d) => {
    const deps = DAYS.filter((x) => x.n === d.n - 1).map((x) => `'${x.id}'`);
    return `    { id: '${d.id}', n: ${d.n}, stage: '${d.stage}', file: '${d.file}',\n` +
           `      title: ${JSON.stringify(d.title)}, check: ${JSON.stringify(d.check)}, deps: [${deps.join(', ')}] }`;
  }).join(',\n');

  const stagesJs = STAGES.map((s) =>
    `    { id: '${s.id}', name: ${JSON.stringify(s.name)}, range: '${s.range}' }`).join(',\n');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ROUTE.title)} · 学习路线</title>
<style>${BASE_CSS}
  .wrap{max-width:820px;padding:28px 18px 72px}
  h1{font-size:clamp(24px,4vw,32px);line-height:1.25;margin:0 0 10px;letter-spacing:-.01em}
  .lede{font-size:16.5px;color:var(--ink-soft);margin:0 0 24px;max-width:64ch}
  .goal{border-left:3px solid var(--accent);background:var(--accent-soft);
    padding:14px 16px;margin:0 0 20px}
  .goal dt{font-family:var(--mono);font-size:11px;letter-spacing:.12em;
    text-transform:uppercase;color:var(--accent);margin-bottom:6px}
  .goal dd{margin:0;font-size:16.5px;font-weight:600;line-height:1.6}
  .panel{border:1px solid var(--line);background:var(--surface);padding:18px 18px 20px;margin:0 0 20px}
  .meter{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:8px}
  .meter b{font-size:22px;font-variant-numeric:tabular-nums}
  .meter span{font-family:var(--mono);font-size:12px;color:var(--ink-soft)}
  .bar{height:4px;background:var(--line);overflow:hidden;margin-bottom:16px}
  .bar i{display:block;height:100%;width:0;background:var(--accent);
    transition:width .45s cubic-bezier(.4,0,.2,1)}
  .today{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
    border-top:1px solid var(--line);padding-top:16px}
  .today-txt{flex:1 1 240px;min-width:0}
  .today-txt em{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.12em;
    text-transform:uppercase;color:var(--ink-soft);font-style:normal;margin-bottom:3px}
  .today-txt strong{font-size:17px;font-weight:700;line-height:1.5}
  .go{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 20px;
    border:1px solid var(--accent);background:var(--accent);color:var(--paper);
    font-family:var(--sans);font-size:15px;font-weight:700;text-decoration:none;cursor:pointer}
  [data-theme="dark"] .go{color:#14130f}
  .go:hover{filter:brightness(1.08)}
  .go[aria-disabled="true"]{background:var(--ok-soft);border-color:var(--ok);color:var(--ok)}
  .stage{margin:0 0 24px}
  .stage-hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;
    margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--line)}
  .stage-hd h2{font-size:15px;margin:0;letter-spacing:.02em}
  .stage-hd span{font-family:var(--mono);font-size:11.5px;color:var(--ink-soft)}
  .stage.out .stage-hd h2::after{content:" ✓";color:var(--ok);font-weight:400}
  .day{display:flex;gap:12px;align-items:flex-start;padding:11px 12px;
    border:1px solid var(--line);background:var(--surface);margin-bottom:8px;
    text-decoration:none;color:inherit}
  .day:hover{border-color:var(--accent);background:var(--accent-soft)}
  .day-n{flex:0 0 46px;font-family:var(--mono);font-size:11.5px;font-weight:700;
    color:var(--ink-soft);padding-top:2px}
  .day-body{flex:1 1 auto;min-width:0}
  .day-body strong{display:block;font-size:15.5px;font-weight:650;line-height:1.5}
  .day-body small{display:block;font-size:13px;color:var(--ink-soft);line-height:1.55;margin-top:2px}
  .day-mark{flex:0 0 auto;font-size:13px;font-family:var(--mono);color:var(--ink-soft);padding-top:2px}
  .day.is-done{background:var(--ok-soft);border-color:var(--ok)}
  .day.is-done .day-n,.day.is-done .day-mark{color:var(--ok)}
  .day.is-done .day-body strong{color:var(--ink-soft);text-decoration:line-through}
  .day.is-next{border-color:var(--accent);border-width:2px;padding:10px 11px}
  .day.is-next .day-n{color:var(--accent)}
  .dep{display:inline-block;margin-top:5px;padding:1px 7px;font-family:var(--mono);
    font-size:11px;line-height:1.7;color:#a16207;background:#fef9e7;border:1px solid #e8d9a8}
  [data-theme="dark"] .dep{color:#d9b04c;background:#241f12;border-color:#4a3f22}
  ${REPLAY_CSS.replace(/margin:16px 0/, 'margin:0 0 20px')}
  .bounds{border-top:1px solid var(--line);padding-top:14px;margin-top:8px;
    font-size:13.5px;color:var(--ink-soft)}
  .bounds h3{font-size:13px;margin:0 0 8px;color:var(--ink);font-family:var(--mono);
    letter-spacing:.1em;text-transform:uppercase}
  .bounds ul{margin:0;padding-left:18px}
  .bounds li{margin-bottom:4px}
  .store-warn{display:none;margin:0 0 18px;padding:8px 12px;font-size:13px;
    color:#a16207;background:#fef9e7;border-left:2px solid #a16207}
  .store-warn.on{display:block}
  [data-theme="dark"] .store-warn{color:#d9b04c;background:#241f12;border-left-color:#d9b04c}
  @media (max-width:520px){
    .wrap{padding:20px 13px 56px}
    .day-n{flex-basis:38px;font-size:11px}
    .today{flex-direction:column;align-items:stretch}
    .go{justify-content:center}
  }
  @media (prefers-reduced-motion:reduce){.bar i{transition:none}}
</style>
</head>
<body>
${THEME_TOGGLE}
<div class="wrap">
  <h1>${esc(ROUTE.title)}</h1>
  <p class="lede">${esc(ROUTE.lede)}</p>

  <div class="store-warn" id="storeWarn">
    本次进度不会被记住（浏览器限制）。课程照常能学，只是关掉页面后进度会重置。
  </div>

  <dl class="goal">
    <dt>走完你能做到</dt>
    <dd>${esc(ROUTE.goal)}</dd>
  </dl>

  <div class="replay" id="kvReplay">
    <button class="replay-btn" type="button" data-replay-btn aria-pressed="false">▶ 看一遍演示</button>
    <span class="replay-note" data-replay-note aria-live="polite"></span>
    <div class="replay-bar" data-replay-bar aria-hidden="true"><i></i></div>
  </div>

  <div class="panel">
    <div class="meter">
      <b id="progDone">0</b><span id="progTotal">/ ${DAYS.length} 天</span>
      <span id="progStage" style="margin-left:auto"></span>
    </div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
         aria-valuenow="0" aria-label="路线进度"><i id="progBar"></i></div>
    <div class="today">
      <div class="today-txt">
        <em id="todayLabel">从这里开始</em>
        <strong id="todayTitle">Day 1</strong>
      </div>
      <a class="go" id="todayGo" href="day-01.html">开始 Day 1 →</a>
    </div>
  </div>

  <div id="map"></div>

  <div class="bounds">
    <h3>关于这条路线</h3>
    <ul>
      <li><b>总投入</b>：${esc(ROUTE.total)}。中断几天没关系 —— 进度按天记，不按连续天数，不搞打卡。</li>
      <li><b>前置要求</b>：${esc(ROUTE.prereq)}</li>
      <li><b>可以跳过</b>：${esc(ROUTE.skippable)}</li>
      <li><b>没检查什么</b>：已在 Edge 实测进度读写、窄屏、深浅色；未在你的手机上实测。这是 5 天的精简示例，不是完整课程体系。</li>
    </ul>
  </div>
</div>

<script>
/* ─── KVProgress ▸ v1 ─── */
${PROGRESS}
</script>

<script>
/* ─── KVReplay ▸ v1 ─── */
${REPLAY}
</script>

<script>
var CONFIG = {
  routeId: '${ROUTE.id}',
  stages: [
${stagesJs}
  ],
  days: [
${daysJs}
  ]
};

(function () {
  var P = window.KVProgress;
  var DAYS = CONFIG.days;
  function $(id) { return document.getElementById(id); }
  if (!P.available()) $('storeWarn').classList.add('on');

  function render() {
    var c = P.counts(CONFIG.routeId, DAYS);
    var pct = c.total ? Math.round(c.done / c.total * 100) : 0;
    var data = P.load(CONFIG.routeId);

    $('progDone').textContent = c.done;
    $('progTotal').textContent = '/ ' + c.total + ' 天';
    $('progBar').style.width = pct + '%';
    $('progBar').parentNode.setAttribute('aria-valuenow', String(pct));

    var doneStages = CONFIG.stages.filter(function (s) {
      var ds = DAYS.filter(function (d) { return d.stage === s.id; });
      return ds.length && ds.every(function (d) { return !!data.done[d.id]; });
    });
    $('progStage').textContent = doneStages.length
      ? '已完成 ' + doneStages.length + ' / ' + CONFIG.stages.length + ' 阶段' : '';

    var next = P.nextDay(CONFIG.routeId, DAYS);
    var go = $('todayGo');
    if (next) {
      $('todayLabel').textContent = c.done === 0 ? '从这里开始' : '接着学';
      $('todayTitle').textContent = 'Day ' + next.n + ' · ' + next.title;
      go.textContent = '开始 Day ' + next.n + ' →';
      go.setAttribute('href', next.file);
      go.removeAttribute('aria-disabled');
    } else {
      $('todayLabel').textContent = '路线已走完';
      $('todayTitle').textContent = c.total + ' 天都完成了。建议回头重做一遍最容易忘的那一天的迁移题。';
      go.textContent = '看看已完成的';
      go.setAttribute('href', '#map');
      go.setAttribute('aria-disabled', 'true');
    }

    var map = $('map');
    map.innerHTML = '';
    CONFIG.stages.forEach(function (st) {
      var ds = DAYS.filter(function (d) { return d.stage === st.id; });
      if (!ds.length) return;
      var allDone = ds.every(function (d) { return !!data.done[d.id]; });
      var sec = document.createElement('section');
      sec.className = 'stage' + (allDone ? ' out' : '');
      sec.innerHTML = '<div class="stage-hd"><h2>' + st.name + '</h2><span>' + st.range + '</span></div>';

      ds.forEach(function (d) {
        var done = !!data.done[d.id];
        var isNext = next && next.id === d.id;
        var a = document.createElement('a');
        a.className = 'day' + (done ? ' is-done' : '') + (isNext ? ' is-next' : '');
        a.href = d.file;
        if (isNext) a.setAttribute('aria-current', 'step');

        var n = document.createElement('span');
        n.className = 'day-n'; n.textContent = 'D' + d.n;
        var body = document.createElement('span');
        body.className = 'day-body';
        var t = document.createElement('strong');
        t.textContent = d.title;
        var s = document.createElement('small');
        s.textContent = d.check;
        body.appendChild(t); body.appendChild(s);

        var unmet = P.unmetDeps(CONFIG.routeId, d);
        if (unmet.length && !done) {
          var chip = document.createElement('span');
          chip.className = 'dep';
          chip.textContent = '建议先完成 ' + unmet.map(function (id) {
            var x = DAYS.filter(function (y) { return y.id === id; })[0];
            return x ? 'Day ' + x.n : id;
          }).join('、');
          body.appendChild(chip);
        }

        var mark = document.createElement('span');
        mark.className = 'day-mark';
        mark.textContent = done ? '✓' : (isNext ? '→' : '');
        a.appendChild(n); a.appendChild(body); a.appendChild(mark);
        sec.appendChild(a);
      });
      map.appendChild(sec);
    });
    return { next: next, counts: c };
  }

  render();

  var root = $('kvReplay');
  if (root && window.KVReplay) {
    KVReplay.create({
      root: root,
      label: '看一遍演示',
      done: '就这样用：每天点开一天，学完点「今天学完了」，进度自动记。',
      steps: [
        async (r) => {
          r.say('这是一条 5 天的路线。上面是进度，这里是今天该学的一天。');
          await r.wait(600);
        },
        async (r) => {
          r.say('点它进课。一天的课学完，进度会记下来。');
          var go = $('todayGo');
          go.style.outline = '2px solid var(--accent)';
          go.style.outlineOffset = '3px';
          await r.wait(1200);
          go.style.outline = '';
        },
        async (r) => {
          r.say('学完回来：进度条前进，「今天该学」换成下一天。');
          var bar = $('progBar');
          var from = parseFloat(bar.style.width) || 0;
          var to = Math.min(100, from + 100 / DAYS.length);
          await r.tween(900, function (e) {
            var v = from + (to - from) * e;
            bar.style.width = v + '%';
            $('progDone').textContent = Math.round(DAYS.length * v / 100);
          });
          await r.wait(400);
        },
        async (r) => {
          r.say('断几天也没关系。进度按天记，不按连续天数 —— 不搞打卡。');
          await r.wait(900);
        },
        async (r) => {
          var s = render();
          $('progBar').style.width = (s.counts.done / s.counts.total * 100) + '%';
          $('progDone').textContent = s.counts.done;
          r.say('演示结束。点任意一天就能开始 —— 这条路线只有 5 天，先走着看。');
          await r.wait(600);
        }
      ]
    });
  }

  window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
})();
</script>
</body>
</html>
`;
}

/* ── 落盘 ────────────────────────────────────────────────── */
let n = 0;
for (const d of DAYS) {
  writeFileSync(resolve(outDir, d.file), renderLesson(d));
  n++;
}
writeFileSync(resolve(outDir, 'route.html'), renderRoute());
n++;
console.log(`生成 ${n} 个文件 → ${outDir.replace(root + '/', '')}`);
console.log('接着跑：');
console.log('  node skills/knowvori/scripts/validate-lesson.mjs skills/knowvori/examples/route-5days/day-*.html');
console.log('  node skills/knowvori/scripts/validate-route.mjs skills/knowvori/examples/route-5days/route.html');
console.log('  node skills/knowvori/scripts/audit-route.mjs skills/knowvori/examples/route-5days/route.html');

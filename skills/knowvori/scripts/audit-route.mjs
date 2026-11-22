#!/usr/bin/env node
/**
 * knowvori · audit-route.mjs
 *
 * 真的打开一条学习路线的汇总页，验证「进度」是真的在动，不是画上去的。
 *
 * 用法：
 *   node audit-route.mjs <route.html> [更多...]
 *
 * 查 6 项：
 *   1. 运行时报错 / console error
 *   2. 零外部请求（真的没发出去请求）
 *   3. 「今天该学」会随进度变化（改存储后必须变）
 *   4. 边界：全部完成 / 数据损坏 不崩
 *   5. localStorage 被禁用时页面仍可用
 *   6. 窄屏无横向溢出、触控目标够大
 *
 * 为什么必须在真浏览器里跑：静态检查只能确认「调用了 nextDay()」，
 * 确认不了「调用之后页面真的变了」。签名对、实现错，静态查不出来。
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function loadPlaywright() {
  const tried = [];
  const candidates = [
    here,
    path.resolve(here, '../../..'),
    path.resolve(here, '../../../tools/audit-deps'),
    ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  ];
  for (const base of candidates) {
    try {
      const mod = require(path.join(base, 'node_modules', 'playwright-core'));
      if (mod && mod.chromium) return mod;
    } catch { tried.push(base); }
    try {
      const mod = require(base);
      if (mod && mod.chromium) return mod;
    } catch { /* 继续找 */ }
  }
  try {
    const mod = require('playwright-core');
    if (mod && mod.chromium) return mod;
  } catch { /* 真的没有 */ }

  console.error(C.red('✗ 找不到 playwright-core'));
  console.error(C.dim('  试过：' + tried.join(', ')));
  console.error('  装一下：cd tools/audit-deps && npm install');
  process.exit(2);
}

const pw = loadPlaywright();

const CHANNELS = ['msedge', 'chrome', null];

async function launch() {
  for (const channel of CHANNELS) {
    try {
      return await pw.chromium.launch(channel ? { channel } : {});
    } catch (e) { /* 下一个 */ }
  }
  console.error(C.red('✗ 起不来浏览器（试过 msedge / chrome / 自带 chromium）'));
  process.exit(2);
}

function parseDays(html) {
  const block = html.match(/days:\s*\[([\s\S]*?)\n\s*\]/);
  if (!block) return [];
  const days = [];
  for (const m of block[1].matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?\}/g)) {
    const obj = m[0];
    const n = obj.match(/n:\s*(\d+)/);
    days.push({ id: m[1], n: n ? Number(n[1]) : null });
  }
  return days;
}

async function audit(browser, file) {
  const results = [];
  const add = (level, rule, msg) => results.push({ level, rule, msg });

  const html = fs.readFileSync(file, 'utf8');
  const days = parseDays(html);
  const routeIdMatch = html.match(/routeId:\s*'([^']+)'/);
  const routeId = routeIdMatch ? routeIdMatch[1] : 'route-id-here';

  const url = pathToFileURL(path.resolve(file)).href;
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });

  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('file://') && !u.startsWith('data:')) requests.push(u);
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // ───────── 1. 运行时报错 ─────────
  add(errors.length ? 'error' : 'pass', '运行时报错',
    errors.length ? errors.slice(0, 2).join(' | ') : '无 pageerror / console error');

  // ───────── 2. 零外部请求 ─────────
  add(requests.length ? 'error' : 'pass', '零外部请求',
    requests.length ? `${requests.length} 个外部请求：${requests.slice(0, 2).join(', ')}` : '未发出任何外部请求');

  // ───────── 3. 「今天该学」跟着进度变 ─────────
  const readToday = () => page.evaluate(() => ({
    label: document.getElementById('todayLabel')?.textContent || '',
    title: document.getElementById('todayTitle')?.textContent || '',
    done: document.getElementById('progDone')?.textContent || '',
    bar: document.getElementById('progBar')?.style.width || '',
    nextCards: document.querySelectorAll('.day.is-next').length,
    doneCards: document.querySelectorAll('.day.is-done').length,
  }));

  const t0 = await readToday();

  // 标记第一天完成 -> 刷新 -> 必须指向第二天
  if (days.length >= 2) {
    await page.evaluate(([rid, id]) => window.KVProgress.markDone(rid, id), [routeId, days[0].id]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const t1 = await readToday();

    const advanced = t1.done !== t0.done && t1.doneCards > t0.doneCards;
    const movedOn = !t1.title.includes('Day ' + days[0].n) || days[0].n === null;
    if (!advanced) {
      add('error', '今天该学跟着变', `标记 Day 1 完成后进度没变（${t0.done} → ${t1.done}）`);
    } else if (!movedOn) {
      add('error', '今天该学跟着变', 'Day 1 已完成，「今天该学」还指着 Day 1');
    } else {
      add('pass', '今天该学跟着变', `完成 Day 1 后：进度 ${t0.done} → ${t1.done}，指向「${t1.title.slice(0, 20)}」`);
    }

    // 撤销后必须退回去
    await page.evaluate(([rid, id]) => window.KVProgress.undoSelf(rid, id), [routeId, days[0].id]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const t2 = await readToday();
    add(t2.done === t0.done ? 'pass' : 'error', '撤销能退回',
      t2.done === t0.done ? `撤销后进度回到 ${t2.done}` : `撤销无效：还是 ${t2.done}`);
  } else {
    add('warn', '今天该学跟着变', '天数不足 2，跳过推进验证');
  }

  // ───────── 4. 边界：全部完成 / 数据损坏 ─────────
  if (days.length) {
    await page.evaluate(([rid, ids]) => {
      ids.forEach((id) => window.KVProgress.markDone(rid, id));
    }, [routeId, days.map((d) => d.id)]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const allDone = await readToday();
    const total = days.length;
    const okAll = allDone.done === String(total) && allDone.nextCards === 0;
    add(okAll ? 'pass' : 'error', '全部完成不崩',
      okAll ? `全完成时进度 ${allDone.done}/${total}，不再有「下一天」卡片，提示「${allDone.label}」`
            : `全完成后状态不对：done=${allDone.done} next=${allDone.nextCards}`);

    // 数据损坏
    await page.evaluate((rid) => {
      localStorage.setItem('kv:route:' + rid, '{{{坏掉的json');
    }, routeId);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(300);
    const corrupt = await readToday();
    const okCorrupt = corrupt.done === '0' && corrupt.nextCards === 1;
    add(okCorrupt ? 'pass' : 'error', '数据损坏当未开始',
      okCorrupt ? '损坏数据被当空进度，页面正常' : `损坏数据后状态异常：done=${corrupt.done}`);

    await page.evaluate((rid) => localStorage.removeItem('kv:route:' + rid), routeId);
  }

  // ───────── 5. localStorage 被禁用时不崩 ─────────
  {
    const p2 = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errs2 = [];
    p2.on('pageerror', (e) => errs2.push(e.message));
    // 在页面脚本跑之前把 localStorage 打瘸
    await p2.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('denied', 'SecurityError'); },
      });
    });
    await p2.goto(url, { waitUntil: 'load' });
    await p2.waitForTimeout(400);
    const r = await p2.evaluate(() => ({
      cards: document.querySelectorAll('.day').length,
      warn: document.getElementById('storeWarn')?.classList.contains('on') || false,
      title: document.getElementById('todayTitle')?.textContent || '',
    }));
    const ok = errs2.length === 0 && r.cards > 0 && r.title;
    add(ok ? 'pass' : 'error', '存不了也能学',
      ok ? `localStorage 禁用时不报错，仍渲染 ${r.cards} 天${r.warn ? '，并提示进度不保存' : ''}`
         : `禁用 localStorage 后异常：${errs2[0] || '页面空白'}`);
    await p2.close();
  }

  // ───────── 6. 窄屏溢出 + 触控目标 ─────────
  {
    const p3 = await browser.newPage({ viewport: { width: 360, height: 800 } });
    await p3.goto(url, { waitUntil: 'load' });
    await p3.waitForTimeout(400);
    const m = await p3.evaluate(() => {
      const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const go = document.getElementById('todayGo');
      const goH = go ? Math.round(go.getBoundingClientRect().height) : 0;
      return { overflow, goH };
    });
    const ok = m.overflow <= 1 && m.goH >= 40;
    add(ok ? 'pass' : 'error', '窄屏与触控',
      ok ? `360px 下无横向溢出，主按钮高 ${m.goH}px`
         : `溢出 ${m.overflow}px，主按钮高 ${m.goH}px（应 ≥40）`);
    await p3.close();
  }

  await page.close();
  return { file, results, days };
}

function report({ file, results, days }) {
  console.log(`\n${C.bold('━'.repeat(62))}`);
  console.log(`${C.bold('路线审计')} ${path.basename(file)}${days.length ? C.dim(`  (${days.length} 天)`) : ''}`);
  console.log(C.bold('━'.repeat(62)));

  let errors = 0, warnings = 0, passes = 0;
  for (const r of results) {
    const icon = r.level === 'error' ? C.red('✗ ERROR')
      : r.level === 'warn' ? C.yellow('! WARN ')
      : C.green('✓ PASS ');
    console.log(`${icon} ${C.bold(r.rule.padEnd(14))} ${r.msg}`);
    if (r.level === 'error') errors++;
    else if (r.level === 'warn') warnings++;
    else passes++;
  }
  console.log(C.dim('─'.repeat(62)));
  console.log(`  ${C.green(`pass ${passes}`)}   ${C.yellow(`warn ${warnings}`)}   ${C.red(`error ${errors}`)}`);

  if (errors > 0) console.log(C.red(`\n  ✗ ${errors} 项 error 必须先修。`));
  else console.log(C.green('\n  ✓ 路线运行正常。仍需人工判断：拆天是否合理、每课是否真的合格。'));
  return errors;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.log('用法: node audit-route.mjs <route.html> [更多...]');
  process.exit(2);
}

const browser = await launch();
let anyError = false;
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(C.red(`文件不存在: ${f}`)); anyError = true; continue; }
  if (report(await audit(browser, f)) > 0) anyError = true;
}
await browser.close();
process.exit(anyError ? 1 : 0);

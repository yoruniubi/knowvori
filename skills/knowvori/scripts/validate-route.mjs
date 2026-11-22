#!/usr/bin/env node
/**
 * knowvori · validate-route.mjs
 *
 * 静态检查一条学习路线的汇总页（route.html），以及它引用的每日课程是否都在。
 *
 * 用法：
 *   node validate-route.mjs <route.html>
 *
 * 退出码：0 = 无 error；1 = 有 error；2 = 用法错误
 *
 * 设计原则同 validate-lesson.mjs：宁可漏报（warn）也不误报（error）。
 */

import fs from 'node:fs';
import path from 'node:path';

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/* 从 CONFIG 里抠出天列表。不做完整 JS 解析 —— 只认模板里那种字面量写法，
   够用，且不会因为文件里有复杂表达式就崩。 */
function parseDays(html) {
  const days = [];
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?\}/g;
  const block = html.match(/days:\s*\[([\s\S]*?)\n\s*\]/);
  if (!block) return days;
  let m;
  while ((m = re.exec(block[1]))) {
    const obj = m[0];
    const get = (k) => {
      const mm = obj.match(new RegExp(k + ":\\s*'([^']*)'"));
      return mm ? mm[1] : null;
    };
    const num = obj.match(/n:\s*(\d+)/);
    days.push({
      id: get('id'),
      n: num ? Number(num[1]) : null,
      stage: get('stage'),
      file: get('file'),
      title: get('title'),
      raw: obj,
    });
  }
  return days;
}

function check(html, file) {
  const results = [];
  const add = (level, rule, msg) => results.push({ level, rule, msg });
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');

  // ───────── 1. 零外部请求 ─────────
  const externalRefs = [];
  const attrRe = /\b(?:src|href|action)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(stripped))) {
    const url = m[1].trim();
    if (/^(https?:)?\/\//i.test(url) || /^data:.*;base64/i.test(url) === false && /^\/\//.test(url)) {
      if (/^(https?:)?\/\//i.test(url)) externalRefs.push(url);
    }
  }
  if (externalRefs.length) {
    add('error', '零外部请求', `发现 ${externalRefs.length} 个外部引用：${externalRefs.slice(0, 3).join(', ')}`);
  } else {
    add('pass', '零外部请求', '无 http(s) 引用，断网可开');
  }

  // ───────── 2. 单文件：引擎必须内联 ─────────
  const hasProg = html.includes('KVProgress ▸ v1');
  const hasReplay = html.includes('KVReplay ▸ v1');
  if (!hasProg) {
    add('error', '进度引擎', '缺 KVProgress ▸ v1，汇总页无法显示进度');
  } else if (/<script[^>]+src=/i.test(stripped)) {
    add('error', '进度引擎', '用 <script src> 外链引擎，破坏单文件交付');
  } else {
    add('pass', '进度引擎', '进度引擎已内联');
  }
  add(hasReplay ? 'pass' : 'warn', '自动回放',
    hasReplay ? '回放引擎已内联' : '无回放引擎，「这页怎么用」只能靠文字说明');

  // ───────── 3. 驾驶舱六块 ─────────
  const blocks = {
    '终点句': /class="goal"/.test(html),
    '进度': /id="progDone"/.test(html) && /id="progBar"/.test(html),
    '今天该学': /id="todayTitle"/.test(html) && /id="todayGo"/.test(html),
    '路线图容器': /id="map"/.test(html),
    '依赖提示': /class="dep"/.test(html) || /unmetDeps/.test(html),
    '边界说明': /class="bounds"/.test(html),
  };
  const missing = Object.entries(blocks).filter(([, ok]) => !ok).map(([k]) => k);
  if (!missing.length) {
    add('pass', '驾驶舱六块', '终点 / 进度 / 今天该学 / 路线图 / 依赖 / 边界 齐全');
  } else if (missing.length <= 2) {
    add('warn', '驾驶舱六块', `缺 ${missing.join('、')}`);
  } else {
    add('error', '驾驶舱六块', `汇总页缺关键区块：${missing.join('、')}，这会退化成目录`);
  }

  // ───────── 4. 「今天该学」必须是算出来的 ─────────
  if (/nextDay\s*\(/.test(html)) {
    add('pass', '今天该学是算出来的', '调用了 nextDay()，不是写死的');
  } else {
    add('error', '今天该学是算出来的', '没找到 nextDay() 调用 —— 「今天该学」可能是硬编码的');
  }

  // ───────── 5. 边界情况有处理 ─────────
  const edge = {
    '全部完成': /next\s*\)\s*\{[\s\S]{0,400}?\}\s*else/.test(html) || /路线已走完/.test(html),
    '数据损坏': /catch/.test(html) && /load/.test(html),
    '存不了': /available\(\)/.test(html) || /canStore/.test(html),
  };
  const edgeMissing = Object.entries(edge).filter(([, ok]) => !ok).map(([k]) => k);
  add(edgeMissing.length ? 'warn' : 'pass', '边界情况',
    edgeMissing.length ? `未见处理：${edgeMissing.join('、')}` : '全完成 / 数据损坏 / 存不了 均有处理');

  // ───────── 6. 禁用刷分激励 ─────────
  //
  // 只查「真的做了」，不查「提到某个词」。
  // 模板里写「不搞打卡逼你」「不按连续天数」是明确表态不做，
  // 早期版本把这种否定句也判成 error，是误报。
  const banned = [
    { re: /(?:连续|打卡)[^。；\n]{0,8}(?:\d+\s*天|徽章|奖励|解锁)/gi, name: '打卡/连续天数' },
    { re: /leaderboard|排行榜|积分排行/gi, name: '排行榜' },
    { re: /class="[^"]*\b(?:score|points|badge)\b/gi, name: '分数/徽章 UI' },
  ];
  const NEG = /不|别|禁止|避免|无需|没有|未|莫/;
  const bad = [];
  for (const { re, name } of banned) {
    let mm;
    while ((mm = re.exec(stripped))) {
      // 往前看 16 个字，若在同一句里出现否定词，视为「声明不做」
      const before = stripped.slice(Math.max(0, mm.index - 16), mm.index);
      const sentence = before.split(/[。；\n！？]/).pop();
      if (NEG.test(sentence)) continue;
      bad.push(name);
      break;
    }
  }
  if (bad.length) {
    add('error', '禁用刷分激励', `出现 ${[...new Set(bad)].join('、')} —— 把学习变成刷分`);
  } else {
    add('pass', '禁用刷分激励', '无打卡 / 排行榜 / 分数');
  }

  // ───────── 7. 天列表完整性 ─────────
  const days = parseDays(html);
  if (!days.length) {
    add('error', '天列表', 'CONFIG.days 里没解析出任何一天');
  } else {
    const badIds = days.filter((d) => !d.id || !/^day-\d+$/.test(d.id));
    const noFile = days.filter((d) => !d.file);
    const dupIds = days.map((d) => d.id).filter((id, i, a) => a.indexOf(id) !== i);
    const noDepsKey = days.filter((d) => !/deps:\s*\[/.test(d.raw));

    if (badIds.length) {
      add('error', '天列表', `id 格式应为 day-NN：${badIds.map((d) => d.id || '(空)').join(', ')}`);
    } else if (dupIds.length) {
      add('error', '天列表', `id 重复：${[...new Set(dupIds)].join(', ')}（进度会串）`);
    } else if (noFile.length) {
      add('error', '天列表', `这些天没有 file：${noFile.map((d) => d.id).join(', ')}`);
    } else if (noDepsKey.length) {
      add('warn', '天列表', `这些天没写 deps：${noDepsKey.map((d) => d.id).join(', ')}`);
    } else {
      add('pass', '天列表', `${days.length} 天，id 唯一、file 齐全、deps 显式`);
    }

    // ───────── 8. 课程文件是否真的存在 ─────────
    const dir = path.dirname(file);
    const missingFiles = days
      .filter((d) => d.file && !fs.existsSync(path.join(dir, d.file)))
      .map((d) => d.file);
    if (missingFiles.length === days.length) {
      add('warn', '课程文件存在', `全部 ${days.length} 个文件尚未生成（路由模板演示时正常，交付前必须补齐）`);
    } else if (missingFiles.length) {
      add('error', '课程文件存在', `缺 ${missingFiles.length} 个：${missingFiles.slice(0, 5).join(', ')}${missingFiles.length > 5 ? ' …' : ''}`);
    } else {
      add('pass', '课程文件存在', `${days.length} 个 day 文件都在`);
    }

    // ───────── 9. 依赖不成环 ─────────
    const byId = new Map(days.map((d) => [d.id, d]));
    const depsOf = (d) => {
      const mm = d.raw.match(/deps:\s*\[([^\]]*)\]/);
      if (!mm) return [];
      return [...mm[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    };
    const state = new Map(); // 0=未访问 1=访问中 2=完成
    let cycle = null;
    const visit = (id, stack) => {
      if (cycle) return;
      const st = state.get(id) || 0;
      if (st === 1) { cycle = [...stack, id]; return; }
      if (st === 2) return;
      state.set(id, 1);
      for (const dep of depsOf(byId.get(id))) {
        if (byId.has(dep)) visit(dep, [...stack, id]);
      }
      state.set(id, 2);
    };
    for (const d of days) visit(d.id, []);
    if (cycle) {
      add('error', '依赖不成环', `发现循环依赖：${cycle.join(' → ')}`);
    } else {
      // 悬空依赖：指向不存在的天
      const dangling = [];
      for (const d of days) {
        for (const dep of depsOf(d)) if (!byId.has(dep)) dangling.push(`${d.id}→${dep}`);
      }
      if (dangling.length) {
        add('error', '依赖不成环', `依赖指向不存在的天：${dangling.slice(0, 4).join(', ')}`);
      } else {
        add('pass', '依赖不成环', '依赖图无环、无悬空引用');
      }
    }

    // ───────── 10. 阶段完整性 ─────────
    const stagesUsed = new Set(days.map((d) => d.stage).filter(Boolean));
    const stageDecl = [...html.matchAll(/stages:\s*\[([\s\S]*?)\n\s*\]/g)];
    const stageIds = stageDecl.length
      ? [...stageDecl[0][1].matchAll(/id:\s*'([^']+)'/g)].map((x) => x[1])
      : [];
    const undefinedStage = [...stagesUsed].filter((s) => !stageIds.includes(s));
    if (undefinedStage.length) {
      add('warn', '阶段完整', `这些 stage 未在 CONFIG.stages 声明：${undefinedStage.join(', ')}`);
    } else if (stageIds.length && stageIds.length !== stagesUsed.size) {
      add('warn', '阶段完整', `声明了 ${stageIds.length} 个阶段，实际只用了 ${stagesUsed.size} 个`);
    } else {
      add('pass', '阶段完整', '阶段声明与使用一致');
    }
  }

  // ───────── 11. 无障碍 / 触控 ─────────
  const issues = [];
  if (!/aria-valuenow/.test(html)) issues.push('进度条无 aria-valuenow');
  if (!/aria-live="polite"/.test(html)) issues.push('旁白无 aria-live');
  if (!/@media\s*\(max-width/.test(html)) issues.push('无窄屏断点');
  if (!/min-height:\s*4[0-9]px/.test(html)) issues.push('触控目标未设最小高度');
  if (!/prefers-reduced-motion/.test(html)) issues.push('未尊重减少动效偏好');
  add(issues.length ? 'warn' : 'pass', '无障碍', issues.length ? issues.join('；') : '进度条 / 旁白 / 窄屏 / 触控 / 减少动效 均照顾');

  return { file, results, days };
}

function report({ file, results, days }) {
  const name = path.basename(file);
  console.log(`\n${C.bold('━'.repeat(62))}`);
  console.log(`${C.bold('路线检查')} ${name}${days.length ? C.dim(`  (${days.length} 天)`) : ''}`);
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

  if (errors > 0) {
    console.log(C.red(`\n  ✗ ${errors} 项 error 必须先修。`));
  } else if (warnings > 0) {
    console.log(C.yellow(`\n  ⚠ 可交付，但 ${warnings} 项需人工确认。`));
  } else {
    console.log(C.green('\n  ✓ 汇总页静态检查全通过。进度逻辑仍需真跑一遍（见 audit-route）。'));
  }
  return errors;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.log('用法: node validate-route.mjs <route.html>');
  process.exit(2);
}

let anyError = false;
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log(C.red(`文件不存在: ${f}`));
    anyError = true;
    continue;
  }
  if (report(check(fs.readFileSync(f, 'utf8'), f)) > 0) anyError = true;
}

process.exit(anyError ? 1 : 0);

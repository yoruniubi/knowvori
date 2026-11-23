#!/usr/bin/env node
/**
 * knowvori · validate-lesson.mjs
 *
 * 静态检查一份交互式课程 HTML。只查「机器能判的」，查不出教学质量的。
 *
 * 用法：
 *   node validate-lesson.mjs <课程.html> [更多.html ...]
 *
 * 退出码：0 = 无 error；1 = 有 error；2 = 用法错误
 *
 * 设计原则：宁可漏报（warn）也不误报（error）。
 * 一个老误报 error 的检查器，会训练人忽略它的输出。
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

function check(html, file) {
  const results = [];
  const add = (level, rule, msg) => results.push({ level, rule, msg });

  // 汇总页（驾驶舱）不是日课，判据是「有阶段与天列表 CONFIG，但没有 dayId」。
  // 它该由 validate-route.mjs 检查；在这里逐条报错只会制造假警报，
  // 而假警报比漏报更坏 —— 会训练人忽略真警报。
  const isRouteHub = /stages:\s*\[/.test(html) && /days:\s*\[/.test(html) &&
                     !/dayId:\s*'[^']+'/.test(html);
  if (isRouteHub) {
    add('warn', '文件类型', '这是路线汇总页，不是日课；请用 validate-route.mjs 检查');
    return { file, results };
  }

  // 剥掉注释，避免把注释里的 URL 当成外部请求
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');

  // ───────── 1. 零外部请求（C6 配套：断网可用）─────────
  const externalRefs = [];
  const attrRe = /\b(?:src|href|action)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(stripped))) {
    const url = m[1].trim();
    if (/^(https?:)?\/\//i.test(url)) externalRefs.push(url);
  }
  const importRe = /@import\s+(?:url\()?["']([^"']+)["']/gi;
  while ((m = importRe.exec(stripped))) {
    if (/^(https?:)?\/\//i.test(m[1])) externalRefs.push(m[1]);
  }
  if (externalRefs.length) {
    add('error', '零外部请求', `发现外部引用 ${externalRefs.length} 处：${[...new Set(externalRefs)].slice(0, 5).join(', ')}`);
  } else {
    add('pass', '零外部请求', '无任何外部 src/href/@import');
  }

  // ───────── 2. 单文件 ─────────
  const localRefs = [];
  const attrRe2 = /\b(?:src|href)\s*=\s*["']([^"'#][^"']*)["']/gi;
  while ((m = attrRe2.exec(stripped))) {
    const url = m[1].trim();
    if (/\.(css|js|png|jpe?g|gif|svg|webp|woff2?|ttf|json)$/i.test(url)) localRefs.push(url);
  }
  if (localRefs.length) {
    add('warn', '单文件', `引用了外部本地文件：${[...new Set(localRefs)].join(', ')}（README 需说明）`);
  } else {
    add('pass', '单文件', '无外部本地资源');
  }

  // ───────── 3. 答后展开（C5 / I4）─────────
  const hasQuiz = /class\s*=\s*["'][^"']*\bquiz\b|data-qid|class\s*=\s*["'][^"']*\bopt\b/i.test(html);
  if (!hasQuiz) {
    add('warn', '答后展开', '未检测到自测题结构（data-qid / class="opt"），若确实无自测题则此项不适用');
  } else {
    const explainRe = /<(div|section)[^>]*class\s*=\s*["'][^"']*\bexplain\b[^"']*["'][^>]*>/gi;
    let hiddenOk = 0, notHidden = 0;
    while ((m = explainRe.exec(html))) {
      if (/\bhidden\b|display\s*:\s*none/i.test(m[0])) hiddenOk++;
      else notHidden++;
    }
    if (notHidden > 0 && hiddenOk === 0) {
      add('error', '答后展开', `${notHidden} 处答案容器未默认隐藏——答题前就暴露了答案`);
    } else if (notHidden > 0) {
      add('warn', '答后展开', `${notHidden} 处未隐藏（${hiddenOk} 处正确）`);
    } else if (hiddenOk > 0) {
      add('pass', '答后展开', `${hiddenOk} 处答案容器默认隐藏`);
    } else {
      add('warn', '答后展开', '未找到 .explain 容器，请人工确认答题前不显示答案');
    }
  }

  // ───────── 4. 干扰项解释（C5）─────────
  // 兼容两套约定：data-correct="true|false" 与 data-ok="1|0"
  const optCount = (html.match(/class\s*=\s*["'][^"']*\bopt\b/gi) || []).length;
  const markerCount =
    (html.match(/data-correct\s*=/gi) || []).length +
    (html.match(/data-ok\s*=/gi) || []).length;
  const whyCount = (html.match(/data-why\s*=/gi) || []).length;

  if (optCount === 0) {
    add('warn', '干扰项解释', '未检测到选项，若为开放题请标注「非自动评分」');
  } else if (markerCount < optCount) {
    add('warn', '干扰项解释', `${markerCount}/${optCount} 个选项带对错标记——可能有选项无法判定`);
  } else if (whyCount === 0) {
    add('warn', '干扰项解释', `${optCount} 个选项均无 data-why——答错时无法说明「你可能怎么想的」，需人工补`);
  } else {
    const ratio = Math.round((whyCount / optCount) * 100);
    add(ratio >= 80 ? 'pass' : 'warn', '干扰项解释', `${whyCount}/${optCount} 个选项有 data-why（${ratio}%）`);
  }

  // ───────── 5. 迁移题（I7）─────────
  // 关键词检测不可靠，所以判 warn 交由人工确认，不判 error
  const hasTransfer = /迁移题|迁移|新情境|换一个(场景|情境|例子)|transfer/i.test(html);
  if (hasTransfer) add('pass', '迁移题', '检测到迁移题标记');
  else add('warn', '迁移题', '未检测到迁移题标记（关键词：迁移 / 新情境 / transfer）——缺它只能测记忆，请人工确认');

  // ───────── 6. 反馈可信度分级 ─────────
  const hasGrading = /客观校验|规则评估|开放评价|非自动评分|未自动评分/.test(html);
  if (hasGrading) add('pass', '反馈分级', '标注了反馈可信度类型');
  else add('warn', '反馈分级', '未标注「客观校验/规则评估/开放评价」，用户无法判断反馈可信度');

  // ───────── 7. 无刷分激励 ─────────
  const scoreRe = /得分|积分|连击|排行榜|leaderboard|streak/i;
  const scoreHit = scoreRe.exec(html);
  if (scoreHit) {
    add('warn', '无刷分激励', `检测到「${scoreHit[0]}」——SKILL.md 第 7 节禁止用分数/连击激励`);
  } else {
    add('pass', '无刷分激励', '无分数/连击/排行榜');
  }

  // ───────── 8. 推导链（C4）─────────
  const hasWhy = /为什么/.test(html);
  const hasCounter = /不这样|假如不|否则|如果不这么做|反例/.test(html);
  if (hasWhy && hasCounter) add('pass', '推导链', '含「为什么」与反例');
  else if (hasWhy) add('warn', '推导链', '有「为什么」但未见反例句式（「不这样会…」）');
  else add('error', '推导链', '未见任何「为什么」——很可能只有结论没有推导（C4）');

  // ───────── 9. 可重置 ─────────
  const hasReset = /重置|reset|重新开始/i.test(html);
  if (hasReset) add('pass', '可重置', '提供重置入口');
  else if (hasQuiz) add('warn', '可重置', '有交互/自测但未见重置入口，试错后可能回不到初始状态');
  else add('pass', '可重置', '无交互实验，不适用');

  // ───────── 10. 移动适配 ─────────
  const hasViewport = /<meta[^>]+name\s*=\s*["']viewport["']/i.test(html);
  if (hasViewport) add('pass', '移动适配', '有 viewport meta');
  else add('error', '移动适配', '缺 <meta name="viewport">，手机上会缩成针尖');

  // ───────── 11. 不依赖悬停 ─────────
  const hoverCritical = /:hover[^{]*\{[^}]*display\s*:\s*block/i.test(html);
  if (hoverCritical) add('warn', '不依赖悬停', '检测到 hover 控制 display——手机上会看不到内容');
  else add('pass', '不依赖悬停', '未见 hover 控制可见性');

  // ───────── 12. 体量（教学量体检）─────────
  const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  if (kb > 400) add('warn', '体量', `${kb}KB，超出单节课程常见范围（≤400KB），确认是否塞了两节课`);
  else add('pass', '体量', `${kb}KB`);

  // ───────── 13. 标题 ─────────
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) add('pass', '标题', titleMatch[1].trim());
  else add('warn', '标题', '缺 <title>，浏览器标签页会显示文件名');

  // ───────── 14. 深色 / 浅色主题（通用体验要求）─────────
  const hasDark = /prefers-color-scheme\s*:\s*dark|data-theme\s*=|classList\.(toggle|add)\(\s*['"]dark|setAttribute\(\s*['"]data-theme/i.test(html);
  if (hasDark) add('pass', '深色模式', '支持深色主题（自动或可切换）');
  else add('warn', '深色模式', '未见 prefers-color-scheme / 主题切换——Day/Dark 是通用要求，请人工确认或补上');

  // ───────── 15. 可操作控件（主动操作原则）─────────
  const hasControl = /<input\b|<canvas\b|draggable\s*=|pointerdown|mousedown|touchstart|contenteditable/i.test(html);
  if (hasControl) add('pass', '可操作控件', '检测到可操作控件（输入/画布/拖拽等）');
  else add('warn', '可操作控件', '未检测到可操作控件——确认这是阅读课，还是缺少主动操作');

  // ───────── 16. 自动推进动画可暂停（主动操作原则）─────────
  const hasRAF = /requestAnimationFrame\s*\(/.test(html);
  const hasPause = /暂停|pause|继续|resume/i.test(html);
  if (hasRAF && !hasPause) {
    add('warn', '动画控制', '检测到 requestAnimationFrame 但未见暂停/继续入口——自动播放必须可停');
  } else if (hasRAF) {
    add('pass', '动画控制', '自动推进动画提供暂停/继续');
  } else {
    add('pass', '动画控制', '无自动推进动画，不适用');
  }

  // ───────── 17. 练习是否真的能作答（C5）─────────
  // 只做启发式提示：检测到选项，但脚本里看不到任何绑定/判分逻辑时，
  // 很可能是「摆了一排按钮但点了没反应」。复杂实现可能漏报，所以只 warn。
  if (optCount > 0) {
    const scripts = [...stripped.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[1]).join('\n');
    const hasQuizHandler = /querySelectorAll\s*\(\s*['"]\.(quiz|opt)|dataset\.correct|data-correct|closest\s*\(\s*['"]\.opt/i.test(scripts);
    if (hasQuizHandler) {
      add('pass', '练习可作答', '脚本中检测到选项绑定或判分逻辑');
    } else {
      add('warn', '练习可作答', '检测到选项，但脚本中未见绑定/判分逻辑——按钮可能点了没反应，请人工点一遍');
    }
  } else {
    add('pass', '练习可作答', '无选项，不适用');
  }

  // ───────── 18. 交互反馈区（C8 闭环）─────────
  const hasFeedback = /<output\b|aria-live\s*=|role\s*=\s*["']status|class\s*=\s*["'][^"']*\b(out|result|output|status|feedback|answer|explain)\b/i.test(html);
  if (hasControl && !hasFeedback) {
    add('warn', '反馈区', '有可操作控件但未见结果容器（output / aria-live / .out / .result）——操作后用户看什么？');
  } else if (hasControl) {
    add('pass', '反馈区', '有结果反馈容器');
  } else {
    add('pass', '反馈区', '无交互控件，不适用');
  }

  // ───────── 19. 自动回放一致性 ─────────
  //
  // 演示脚本是复制到每个课程里的（单文件交付不能 import）。
  // 复制就有版本漂移的风险：改了引擎忘了同步某个文件，表现是那一课
  // 按钮点了没反应。所以这里只查「标记是否齐全、顺序是否正确」。
  const hasEngine = html.includes('KVReplay ▸ v1');
  const stepsTag = html.match(/KVReplaySteps ▸ ([^ ]+) ▸ v1/);
  const hasSteps = !!stepsTag;
  const btnCount = (html.match(/data-replay-btn/g) || []).length;

  if (!hasEngine && !hasSteps && !btnCount) {
    add('pass', '自动回放', '本例无自动演示，不适用');
  } else if (!hasEngine) {
    add('error', '自动回放', '有演示按钮却缺 kvreplay 引擎（KVReplay ▸ v1）');
  } else if (!hasSteps) {
    add('error', '自动回放', '有演示按钮却缺演示脚本（KVReplaySteps ▸ … ▸ v1）');
  } else if (btnCount === 0) {
    add('error', '自动回放', '注入了引擎和脚本，但页面上没有 data-replay-btn 按钮');
  } else if (html.indexOf('KVReplay ▸ v1') > html.indexOf('KVReplaySteps ▸')) {
    // 顺序反过来就永远不执行：脚本跑的时候引擎还没定义。
    add('error', '自动回放', '引擎排在演示脚本之后，脚本会静默失效');
  } else {
    add('pass', '自动回放', '引擎 + 演示脚本 + 按钮齐全，顺序正确');
  }

  // ───────── 20. 学习路线：单课侧接线 ─────────
  //
  // 一节课属于某条路线时，必须有进度上报，否则汇总页永远显示未完成。
  // 独立单课（不属于路线）不适用，直接跳过。
  const isLessonWithRoute = html.includes('id="dayDone"') || html.includes('KVProgress ▸ v1');
  if (!isLessonWithRoute) {
    add('pass', '路线接线', '本例不属于学习路线，不适用');
  } else {
    const hasProg = html.includes('KVProgress ▸ v1');
    const hasDoneBox = html.includes('id="dayDone"');
    const hasDayId = /dayId:\s*'[^']+'/.test(html) && !/dayId:\s*''/.test(html);
    const hasRouteId = /routeId:\s*'[^']+'/.test(html) && !/routeId:\s*''/.test(html);

    if (!hasProg) {
      add('error', '路线接线', '有完成按钮但缺进度引擎（KVProgress ▸ v1），进度存不下来');
    } else if (!hasDoneBox) {
      add('warn', '路线接线', '有进度引擎但没有完成按钮（id="dayDone"），用户无法标记学完');
    } else if (!hasRouteId || !hasDayId) {
      add('warn', '路线接线', '完成按钮未接线：CONFIG 的 routeId / dayId 还是空值');
    } else {
      add('pass', '路线接线', '进度引擎 + 完成按钮 + routeId/dayId 已接线');
    }
  }

  // ───────── 21. 学习路线：衔接语气（回指 / 明天预告）─────────
  //
  // 路线里最容易翻车的是「第 8 天假设用户记得第 7 天的细节」。
  // 有 routeId 却没有任何回指，用户停一天回来就接不上了。
  if (/routeId:\s*'[^']+'/.test(html) && !/routeId:\s*''/.test(html)) {
    const hasRecap = html.includes('class="recap"');
    const hasNextUp = html.includes('class="next-up"');
    // 第一天没有「昨天」，本来就不该有回指块
    const dayNum = (html.match(/dayId:\s*'day-(\d+)'/) || [])[1];
    const isFirstDay = dayNum === '01' || dayNum === '1';
    if (!hasRecap && isFirstDay) {
      add('pass', '路线衔接', '第 1 天无前置，不需要回指块');
    } else if (!hasRecap) {
      add('error', '路线衔接', '属于路线但没有回指块（class="recap"），用户隔天回来接不上');
    } else if (!hasNextUp) {
      add('warn', '路线衔接', '有回指但缺「明天预告 / 今天没讲什么」（class="next-up"）');
    } else {
      add('pass', '路线衔接', '回指 + 明天预告齐全');
    }
  } else {
    add('pass', '路线衔接', '非路线课程，不适用');
  }

  // ────────── 22. 术语讲解（C9 小白默认）──────────
  // 最常的毛病不是写错，而是读者卡在第一个没解释的名词上走不下去。
  // 这里只抓两种能机械判定的硬伤，不去猜「讲得够不够好」——
  // 判不准的宁可漏报，假警报会训练人忽略真警报。
  const textOnly = stripped
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  // (a) 假解释：用术语解释术语。
  //    只认「术语」：定义 这种明确格式。早先放宽到「X是Y」就满屏误报——
  //    「真实神经网络是非凸的」只是陈述，不是定义。宁可漏报也不误报。
  const jargonLoops = [];
  const harder = ['导数', '偏导数', '梯度', '向量', '矩阵', '张量', '积分', '概率分布', '特征值', '二次型', '泛函', '拓扑'];
  const defRe = /「([^」]{2,10})」\s*(?:是|指|就是|：|:)\s*([^。\n]{0,60})/g;
  let dm;
  while ((dm = defRe.exec(textOnly))) {
    const term = dm[1];
    const def = dm[2];
    if (!def || def.includes(term)) continue;
    const used = harder.filter((h) => def.includes(h) && !term.includes(h));
    if (used.length) jargonLoops.push(`${term}→${used[0]}`);
  }
  if (jargonLoops.length) {
    add('warn', '术语讲解', `${jargonLoops.length} 处疑似用术语解释术语（${[...new Set(jargonLoops)].slice(0, 3).join('、')}）；小白读到会断`);
  } else {
    add('pass', '术语讲解', '未见「用术语解释术语」');
  }

  // (b) 糊弄词：出现就是「我也没想清楚」
  const hedgeWords = ['众所周知', '不难发现', '显而易见', '简单来说', '顾名思义', '稍微想一下'];
  const hedges = hedgeWords.filter((w) => textOnly.includes(w));
  if (hedges.length) {
    add('warn', '糊弄词', `出现 ${hedges.join('、')}；这些词的真实含义是「没想清楚」`);
  } else {
    add('pass', '糊弄词', '未出现「众所周知 / 显然 / 简单来说」之类糊弄词');
  }

  return { file, results };
}

function report({ file, results }) {
  const name = path.basename(file);
  console.log(`\n${C.bold('━'.repeat(62))}`);
  console.log(`${C.bold('检查')} ${name}`);
  console.log(C.bold('━'.repeat(62)));

  let errors = 0, warnings = 0, passes = 0;
  for (const r of results) {
    const icon = r.level === 'error' ? C.red('✗ ERROR')
      : r.level === 'warn' ? C.yellow('! WARN ')
      : C.green('✓ PASS ');
    console.log(`${icon} ${C.bold(r.rule.padEnd(12))} ${r.msg}`);
    if (r.level === 'error') errors++;
    else if (r.level === 'warn') warnings++;
    else passes++;
  }

  console.log(C.dim('─'.repeat(62)));
  console.log(`  ${C.green(`pass ${passes}`)}   ${C.yellow(`warn ${warnings}`)}   ${C.red(`error ${errors}`)}`);

  if (errors > 0) {
    console.log(C.red(`\n  ✗ ${errors} 项 error 必须先修。注意：脚本全通过 ≠ 课程合格。`));
  } else if (warnings > 0) {
    console.log(C.yellow(`\n  ⚠ 可交付，但 ${warnings} 项 warning 需人工确认或写进 README。`));
  } else {
    console.log(C.green('\n  ✓ 静态检查全通过。仍需人工过 quality-checklist.md 的 1~5 节与第 7 节真实交互验收。'));
  }
  return errors;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.log('用法: node validate-lesson.mjs <课程.html> [更多...]');
  process.exit(2);
}

let anyError = false;
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log(C.red(`文件不存在: ${f}`));
    anyError = true;
    continue;
  }
  const html = fs.readFileSync(f, 'utf8');
  if (report(check(html, f)) > 0) anyError = true;
}

process.exit(anyError ? 1 : 0);

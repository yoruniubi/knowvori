#!/usr/bin/env node
/* 把 assets/ 里的引擎内联进模板占位符。
   课程和汇总页都是单文件交付，不能外链 <script src>，所以引擎必须复制进去。 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const bundles = [
  {
    file: resolve(root, 'skills/knowvori/assets/route-template.html'),
    slots: [
      ['/*__PROGRESS_ENGINE__*/', 'skills/knowvori/assets/route-progress.js'],
      ['/*__REPLAY_ENGINE__*/', 'skills/knowvori/assets/replay-engine.js'],
    ],
  },
  {
    file: resolve(root, 'skills/knowvori/assets/lesson-template.html'),
    slots: [
      ['/*__PROGRESS_ENGINE__*/', 'skills/knowvori/assets/route-progress.js'],
    ],
  },
];

let changed = 0;
for (const { file, slots } of bundles) {
  let src = readFileSync(file, 'utf8');
  for (const [slot, enginePath] of slots) {
    const engine = readFileSync(resolve(root, enginePath), 'utf8').trim();
    // 引擎里若出现 <script> 字面量，内联进 HTML 会提前闭合标签。
    // 这个坑踩过：整块脚本变成纯文本，页面打开像是正常的，只是交互全死。
    if (/<\/?script/i.test(engine)) {
      console.error(`✗ ${enginePath} 含有 <script> 字面量，内联会破坏 HTML`);
      process.exit(1);
    }
    if (!src.includes(slot)) {
      // 模板里这个位置已经有内联好的引擎（不是占位符），跳过
      continue;
    }
    src = src.split(slot).join(engine);
    changed++;
  }
  writeFileSync(file, src);
  console.log('ok', file.replace(root + '/', ''));
}
console.log(changed ? `\n内联了 ${changed} 处引擎。` : '\n模板里没有占位符（已内联过）。');

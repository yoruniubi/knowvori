# tools · 作者用的工具

这个目录**不进** `npx skills add knowvori` 的交付物，只是维护这个仓库时用的辅助脚本。

## inject-replay.mjs

把自动回放的 CSS / 引擎 / 按钮 / 每课演示脚本注入到 `skills/knowvori/examples/` 的 7 份课程里。

```bash
node tools/inject-replay.mjs
```

**为什么需要它**：课程是单文件离线交付，不能 `import`，所以回放引擎只能复制进每个 HTML。复制就有漂移风险——改了引擎忘了同步某一课，表现是「按钮点了没反应」。用脚本一次注入，7 份保证一致。

**它只插入、不删除**。每步都断言「原有脚本一字未改地还在」，不成立就报错退出、不写文件。这条约束是踩坑换来的：早先用正则在已注入的文件上重跑，把课程原有逻辑整段吞掉了，页面打开还像是正常的，只是交互全死。

改演示内容：编辑 `tools/replay-scripts.cjs` 后重跑。
改引擎：编辑 `skills/knowvori/assets/replay-engine.js` 后，先 `git checkout -- skills/knowvori/examples/` 回到干净基线，再重跑。

## replay-scripts.cjs

每课的演示脚本（滑哪个控件、按哪个按钮、说什么话）。被 `inject-replay.mjs` 引用。

## audit-deps/

只为 `skills/knowvori/scripts/audit-page.mjs` 提供 `playwright-core` —— 审计脚本本身没有 `package.json`，靠这个目录找到浏览器驱动。

```bash
cd tools/audit-deps && npm install
```

用你系统上已有的 Edge / Chrome（`channel: 'msedge'`），不额外下载浏览器。

---

录 GIF / MP4 的旧工具已经删了。把课程录成动图是个坏方向：压缩糊、字变小、还不能动手，比直接打开课程更差。改成课程内 `▶ 看一遍演示`——零体积、无损、和真操作共用同一套代码。

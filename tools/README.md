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

## build-route-demo.mjs

生成 `skills/knowvori/examples/route-5days/` 整条示例路线：`route.html` 汇总页 + 5 份 `day-NN.html`。

```bash
node tools/build-route-demo.mjs
```

内容分三个文件，各管一件事：

| 文件 | 管什么 |
|---|---|
| `route-demo-content.mjs` | 每天的内容：标题、卡点、术语、推导四句、三道自测、动手代码与预期输出、明天预告 |
| `route-demo-parts.mjs` | 每天的真算演示（滑块一动就重算重绘）+ 自动回放脚本 |
| `build-route-demo.mjs` | 只负责拼装 HTML，并把 `replay-engine.js` / `route-progress.js` 内联进去 |

**为什么用生成器而不是手写 6 个 HTML**：六份文件共用同一套结构，手写必然漂移——某天忘了加 `class="recap"`，某天把 `data-correct` 写成 `data-right`，校验器就会开始报假警报。生成器让结构只有一处定义，内容各写各的。

生成是幂等的：同样输入两次跑出字节完全一致的输出，`md5sum` 可验证。

## inline-engines.mjs

把引擎源码塞进模板里的占位符（`route-template.html` 用）。内含保护：检测到引擎注释里出现 `<script` 字面量就拒绝，因为内联会提前闭合标签。这条也踩过坑——3D 课曾因注释里写了 `<script src>` 而整块失效。

## audit-deps/

只为 `skills/knowvori/scripts/audit-page.mjs` 提供 `playwright-core` —— 审计脚本本身没有 `package.json`，靠这个目录找到浏览器驱动。

```bash
cd tools/audit-deps && npm install
```

用你系统上已有的 Edge / Chrome（`channel: 'msedge'`），不额外下载浏览器。

---

录 GIF / MP4 的旧工具已经删了。把课程录成动图是个坏方向：压缩糊、字变小、还不能动手，比直接打开课程更差。改成课程内 `▶ 看一遍演示`——零体积、无损、和真操作共用同一套代码。

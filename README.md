# knowvori · 交互式学习 Skill

> **说出你想学什么，拿到一节能动手探索、通过练习检查理解的交互课程。**

一节课不是一篇文章，也不是一张漂亮网页，而是一个**围绕具体学习目标设计的微型学习环境**：能操作、能预测、能看见自己算错在哪、能在一道没见过的新题上把学到的东西用出来。

---

## 这是什么

用户安装后，对支持 Skill 的 Agent 说一句学习需求：

> 「我想理解 Attention，会 Python，但矩阵基础一般。做一节中文交互课程，让我先通过操作理解，再做一道练习。」

Agent 按本 Skill 定义的流程完成：目标拆解 → 卡点分析 → 内容整理 → 交互设计 → 生成单文件 HTML → 自评迭代 → 交付并说明验证边界。

---

## 交互设计参考：Sort Playground 范式

本 Skill 把 [Sort Playground](https://sort.umasort.top/) 当作**交互式知识呈现的参考范式**，而不是模板：

- **借鉴**：可视化对象、动态过程、用户主动操作、即时反馈、原理解释。
- **不照搬**：排序算法、页面布局或具体视觉风格。

核心闭环：

```
预测 → 用户操作 → 状态变化 → 结果反馈 → 原理解释 → 迁移
```

交互必须让用户通过操作理解知识，而不是单纯观看动画。判断标准、五个原则和反模式见 `skills/knowvori/references/interaction-patterns.md`。

---

## 三条硬数据（为什么这样设计）

| 数字 | 出处 | 强制约束 |
|---|---|---|
| 特定生成流程的合格率 **3.5%** → 10 轮改进后 **69.3%** | Kovshov et al., *Harnessing Generative UI for Education*, [arXiv:2609.20738](https://arxiv.org/abs/2609.20738)（Google Research；Gemini 生成流程） | 生成后必须自评再改；10 轮是实验设置，不是每节课的硬指标 |
| 研究中 Guided 对低先验者更有帮助，Buggy 对高先验者更有帮助 | Tithi et al., *Exploring the Design and Impact of Interactive Worked Examples for Learners with Varying Prior Knowledge*, [arXiv:2602.16806](https://arxiv.org/abs/2602.16806) | 先判先验档位，再选练习形式；结果来自逻辑辅导实验，不保证适用于所有主题 |
| 答案对 + 推理错，分类器检出 **57%**；推理模型检出约 **84%**，但假警报约为真检出的 **8 倍** | Imran & Bulathwela, *The Correct Answer Trap*, [arXiv:2606.23205](https://arxiv.org/abs/2606.23205) | 仅看答案对错有风险；开放题必须标「非自动评分」 |

外加：

- **无引导的纯发现学习基本无效**（Kirschner, Sweller & Clark, 2006）
- **只给结论不给推导会制造「理解错觉」**（Hörnlein & Kulgemeyer, 2025, [arXiv:2512.02824](https://arxiv.org/abs/2512.02824)）
- **ICAP 框架**：学习效果 被动 < 主动操作 < 建构 < 互动共创（Chi & Wylie）——所以光点按钮看动画不算学会了

---

## 仓库结构

本仓库是一个 **skills.sh 兼容的技能仓库**：技能本身放在 `skills/<name>/` 里，仓库根目录存放仓库级文件（README、设计稿、许可证）。这样 `npx skills add` 只会打包技能目录，不会把这些仓库文件一起塞进用户的 Agent。

```
knowvori/                             ← 仓库根（不被打包进 skill）
├── README.md                         ← 本文件
├── 设计母本.md                        ← 最初的产品设计稿，保留作历史
└── skills/
    └── knowvori/                     ← 技能本体（打包的就是这个）
        ├── SKILL.md                  # 触发场景、七步工作流、八条硬条款
        ├── references/
        │   ├── teaching-workflow.md      # 澄清红线、卡点清单模板、课程蓝图、自评迭代细则
        │   ├── interaction-patterns.md   # 五个交互原则、核心闭环、Guided/Buggy、反模式
        │   ├── assessment-guidelines.md  # 四档 rubric、Barton 原则、误解库、反馈可信度分级
        │   └── quality-checklist.md      # 五维验收 + 真实交互验收 + 交付清单
        ├── assets/
        │   └── lesson-template.html  # 单文件模板：主题变量 + 深浅色 / 真算演示 / 答后展开 / 重置
        ├── scripts/
        │   └── validate-lesson.mjs   # 静态断言：零外链、答后展开、迁移题、干扰项解释
        └── examples/
            ├── softmax-数值稳定.html # 编程/数值计算：参数化演示 + Buggy 找错
            ├── one-point-perspective.html # 空间关系：可拖动消失点
            └── interview-practice.html # 面试表达：先答后看 + 非自动评分 rubric
```

---

## 怎么用

### 从 GitHub 安装（推荐）

```bash
npx skills add <owner>/knowvori --skill knowvori
```

### 从本地目录安装

```bash
npx skills add . --skill knowvori
```

在仓库根目录执行时，CLI 会在标准位置发现 `skills/knowvori/SKILL.md`。安装后的目录只包含 `skills/knowvori/` 中的 Skill 文件，不会把 README 和设计母本带上。

### 直接手动放置

把 `skills/knowvori/` 整个目录复制到 Agent 的技能目录（例如 `G:\symbix\data\skills\knowvori\`），Agent 会在匹配到「想学 X / 做一节交互课 / 零基础入门」时自动加载。

### 手动验收一份课程

```bash
node skills/knowvori/scripts/validate-lesson.mjs 你的课程.html
```

退出码 `0` = 无 error；`1` = 有 error 必须先修；`2` = 用法错误。

**脚本全通过 ≠ 课程合格。** 它只查结构（有没有外部请求、答案是否答后展开、有没有迁移题标记），查不出「这段讲解有没有制造理解错觉」。人工还得过 `references/quality-checklist.md` 的第 1~5 节。

---

## 检查项一览（17 项）

| 项 | 级别 | 查什么 |
|---|---|---|
| 零外部请求 | error | 有无 `http(s)://` 的 src/href/@import（断网可用） |
| 单文件 | warn | 有无引用本地 css/js/图片 |
| 答后展开 | error/warn | 答案容器是否默认 hidden |
| 干扰项解释 | warn | 每个选项是否带 `data-why`（答错时能说「你可能这样想」） |
| 迁移题 | warn | 有无「迁移 / 新情境 / transfer」标记 |
| 反馈分级 | warn | 是否标注「客观校验 / 规则评估 / 开放评价」 |
| 无刷分激励 | warn | 有无得分/连击/排行榜 |
| 推导链 | error/warn | 有无「为什么」和「不这样会…」 |
| 可重置 | warn | 有无重置入口 |
| 移动适配 | error | 有无 `<meta name="viewport">` |
| 不依赖悬停 | warn | hover 是否控制可见性 |
| 体量 | warn | > 400KB 提示可能塞了两节课 |
| 标题 | warn | 有无 `<title>` |
| 深色模式 | warn | 有无 `prefers-color-scheme` / 主题切换（Day/Dark 通用要求） |
| 可操作控件 | warn | 有无输入 / 画布 / 拖拽等主动操作（阅读课除外） |
| 动画控制 | warn | 检测到 `requestAnimationFrame` 时，有无暂停 / 继续入口 |
| 反馈区 | warn | 有控件时，有无 `output` / `aria-live` / 结果容器 |

设计原则：**宁可漏报（warn）也不误报（error）**。一个老误报 error 的检查器，会训练人忽略它的输出。

---

## 验证记录（2026-11-18）

### 安装测试（`npx skills add`）

| 场景 | 命令 | 结果 |
|---|---|---|
| 本地目录 | `npx skills add E:\knowvori --skill knowvori --copy -a claude-code -y` | ✓ 安装成功；安装目录含 10 个文件，只包含 Skill 本体 |
| GitHub `owner/repo` | 尚无可用的真实远端仓库地址 | 未验证 |

环境：Windows、Node 24.19.0、npm 12.0.2。首次尝试受已有 npm 缓存错误影响；改用隔离的临时 npm cache 后安装成功。

### 课程文件测试

| 被测文件 | 结果 | 说明 |
|---|---|---|
| `assets/lesson-template.html` | **17 pass / 0 warn / 0 error** | 模板本身合规，含中性色深浅主题基线，可作为起点 |
| `examples/softmax-数值稳定.html` | **17 pass / 0 warn / 0 error** | 数值计算与找错练习 |
| `examples/one-point-perspective.html` | **17 pass / 0 warn / 0 error** | 拖动消失点观察透视线变化 |
| `examples/interview-practice.html` | **17 pass / 0 warn / 0 error** | 选择题为客观校验；开放回答明确标为非自动评分 |

以上是静态检查结果；它不等于浏览器兼容性或教学效果测试。新样例的人工浏览器检查仍需按各自文件中的「已检查 / 未检查」说明执行。

### 真实交互验收（2026-11-19，Edge headless + CDP）

| 检查 | 结果 |
|---|---|
| softmax 滑块 | 0 → 900 后朴素版变 NaN、稳定版保持有效；重置回 0 |
| softmax 主题 | 深色下 body `rgb(28,27,24)`、演示区 `rgb(35,33,28)`，文字可读 |
| 一点透视 | End 键把消失点移到 93%，重置回 50%，状态文本与 aria 值同步 |
| 面试练习 | 空稿点「看示例」被拦截；填写后展开；错项显示解释；清空后恢复初始 |
| 手机宽度 | 四份文件在 375px 下 `scrollWidth == innerWidth`，无横向溢出 |
| 断网重载 | 四份文件 `file://` 离线重载均为 complete，脚本输出正常 |
| 控制台 | 以上流程 0 个 error / exception |

**边界**：这是桌面 Edge 的 headless 自动化，不是真机触控；Safari / Firefox 未测，外部用户学习效果未评估。

### 样例自评迭代记录

| 轮次 | 视角 | 发现与处理 |
|---|---|---|
| 1 | Solution / 教学链路 | 面试样例最初缺少解释推理关系的段落；补上判断依据与缺失时的后果。 |
| 2 | Mechanical / 可恢复性 | 静态检查发现面试练习没有重置入口；重置现可清空草稿、重新隐藏示例并恢复选择题。 |
| 3 | Accessibility / Telemetry | 透视消失点新增键盘方向键、Home/End 操作，并用状态文本和 ARIA 值呈现当前坐标。 |
| 4 | Factuality / 反馈边界 | 将面试示例数字标为虚构情境，明确开放回答不会自动评分；静态检查四份文件均通过。 |
| 5 | 交互 / 主题 | 新增交互设计规范后，为模板与三份样例补齐深浅色主题变量；静态检查扩展为 17 项并全部通过。 |

上述迭代是代码与文案检查；真实浏览器自动化验收见上一节。仍未做真机触控、Safari / Firefox 兼容和外部用户学习效果评估。新增的真实交互验收要求见 `references/quality-checklist.md` 第 7 节，需在每次交付前实际执行。

### Agent 工作流测试

| Agent | 安装识别 | 按 Skill 生成课程 | 运行静态检查 | 状态 |
|---|---|---|---|---|
| Claude Code | ✓ 本地 CLI 安装到 `.claude/skills/knowvori/` | 未验证 | 未验证 | 部分验证（仅安装） |
| Codex | 未验证 | 未验证 | 未验证 | 待测 |

母本要求至少两个目标 Agent 完成端到端流程；目前还没有完成该项验收。不要把安装成功写成工作流兼容已验证。

### 已知局限

- 关键词检测（迁移题、推导链）**会漏也会误判**，所以一律判 warn 而非 error，最终靠人工确认
- 查不出：讲解是否准确、类比是否恰当、难度是否递进、数值是否真的算对（这需要执行页面 JS）
- 查不出：交互是否真的闭环、动画与数据是否同步、极端输入是否崩溃（这需要真实浏览器操作）
- `npx skills add` 目前只在 Windows + Node 24 / npm 12 的本地目录来源上实测；GitHub 远程来源和其他操作系统尚未验证
- CLI 会在目标项目里写 `skills-lock.json` 并从 `.agents/skills/` 复制到 Agent 目录，这是 CLI 的行为，不是本技能的行为

---

## 八条硬条款（速查）

| # | 条款 |
|---|---|
| C1 | 目标必须可验证（「能算出」而不是「了解」） |
| C2 | 生成后必须自评迭代：教学 / 交互 / 体验三类各至少一轮，不机械凑 10 轮 |
| C3 | 先判先验档位，再定深度与练习形态 |
| C4 | 每个结论前必须有推导四句（现象→为什么→所以→不这样） |
| C5 | 练习必须能区分「答案对」和「方法对」 |
| C6 | 演示必须真算数，禁止写死的假数字 |
| C7 | 必须声明检查了什么、没检查什么 |
| C8 | 交互必须闭环：操作 → 状态变化 → 结果反馈 → 原理解释，做不到就降级成表格 |

---

## 来源

本 Skill 的教学设计参考公开研究，具体引用和适用边界见本文「三条硬数据」一节及 `skills/knowvori/references/`。研究结果来自特定任务和样本，不应直接当作所有主题、所有 Agent 都成立的普遍效果保证。

**代码与文档由人设计、AI 协助撰写**。脚本逻辑已实测，教学理论部分请以原文为准。

---

## 不做的事

- ❌ 知识点罗列式目录
- ❌ 只有结论没有推导
- ❌ 假动画 / 写死的假数字
- ❌ 自测题直接展示答案
- ❌ 引 CDN / 框架 / 在线字体
- ❌ 只有自动播放、不能暂停 / 重置的演示
- ❌ 为视觉效果强行引入 3D 或额外依赖
- ❌ 用分数 / 连击 / 排行榜做激励
- ❌ 把「页面上答对选择题」说成「已经掌握这门技能」

---

*一句话给未来的自己：这节课最难写的不是解释，是**「先不给答案」的那一段**。*

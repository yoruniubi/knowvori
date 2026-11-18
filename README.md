# knowvori · 交互式学习 Skill

> **说出你想学什么，拿到一节能动手探索、通过练习检查理解的交互课程。**

一节课不是一篇文章，也不是一张漂亮网页，而是一个**围绕具体学习目标设计的微型学习环境**：能操作、能预测、能看见自己算错在哪、能在一道没见过的新题上把学到的东西用出来。

---

## 这是什么

用户安装后，对支持 Skill 的 Agent 说一句学习需求：

> 「我想理解 Attention，会 Python，但矩阵基础一般。做一节中文交互课程，让我先通过操作理解，再做一道练习。」

Agent 按本 Skill 定义的流程完成：目标拆解 → 卡点分析 → 内容整理 → 交互设计 → 生成单文件 HTML → 自评迭代 → 交付并说明验证边界。

---

## 三条硬数据（为什么这样设计）

| 数字 | 出处 | 强制约束 |
|---|---|---|
| 单次生成合格率 **3.5%** → 10 轮自评迭代后 **69.3%** | Kovshov et al., *Harnessing Generative UI for Education*, [arXiv:2609.20738](https://arxiv.org/abs/2609.20738)（Google Research） | 生成完必须自评再改，至少 3 轮，理想 10 轮 |
| 低先验者要 **Guided（填空）**，高先验者要 **Buggy（找错）** | Tithi et al., *Interactive Worked Examples*, [arXiv:2602.16806](https://arxiv.org/abs/2602.16806)（CHI'26） | 先判先验档位，再选练习形态；配反了效果归零 |
| 答案对 + 推理错，微调分类器只查 **57%**；推理模型查 84% 但假阳性 **18%**（≈8:1） | Imran & Bulathwela, *The Correct Answer Trap*, [arXiv:2606.23205](https://arxiv.org/abs/2606.23205) | 只看答案对错 = 在强化误解；开放题必须标「非自动评分」 |

外加：

- **无引导的纯发现学习基本无效**（Kirschner, Sweller & Clark, 2006）
- **只给结论不给推导会制造「理解错觉」**（Hörnlein & Kulgemeyer, 2025, [arXiv:2512.02824](https://arxiv.org/abs/2512.02824)）
- **ICAP 框架**：学习效果 被动 < 主动操作 < 建构 < 互动共创（Chi & Wylie）——所以光点按钮看动画不算学会了

---

## 仓库结构

本仓库是一个 **skills.sh 兼容的技能仓库**：技能本身放在 `skills/<name>/` 里，仓库根目录只放仓库级文件（README、设计稿）。这样 `npx skills add` 只会打包技能目录，不会把 README 和设计稿一起塞进用户的 Agent。

```
knowvori/                             ← 仓库根（不被打包进 skill）
├── README.md                         ← 本文件
├── 设计母本.md                        ← 最初的产品设计稿，保留作历史
└── skills/
    └── knowvori/                     ← 技能本体（打包的就是这个）
        ├── SKILL.md                  # 触发场景、七步工作流、七条硬条款
        ├── references/
        │   ├── teaching-workflow.md      # 澄清红线、卡点清单模板、课程蓝图、自评迭代细则
        │   ├── interaction-patterns.md   # 交互类型对照表、Guided/Buggy 具体做法、反模式
        │   ├── assessment-guidelines.md  # 四档 rubric、Barton 原则、误解库、反馈可信度分级
        │   └── quality-checklist.md      # 五维验收（事实/对齐/SMART/清晰/递进）+ 交付清单
        ├── assets/
        │   └── lesson-template.html  # 单文件模板：真算演示 / 答后展开自测 / 完成清单 / 重置
        ├── scripts/
        │   └── validate-lesson.mjs   # 静态断言：零外链、答后展开、迁移题、干扰项解释
        └── examples/
            └── bayes-guided.html     # 合格产物样例，兼回归测试
```

---

## 怎么用

### 从 GitHub 安装（推荐）

```bash
npx skills add <owner>/knowvori --skill knowvori
```

### 从本地目录安装

```bash
npx skills add ./knowvori --skill knowvori
```

CLI 会在仓库里按标准位置找 `SKILL.md`（根目录 / `skills/` / `.claude/skills/` 等），`skills/knowvori/SKILL.md` 正好命中。装完的技能目录只含技能本体，README 和设计母本不会被带上。

### 直接手动放置

把 `skills/knowvori/` 整个目录复制到 Agent 的技能目录（例如 `G:\symbix\data\skills\knowvori\`），Agent 会在匹配到「想学 X / 做一节交互课 / 零基础入门」时自动加载。

### 手动验收一份课程

```bash
node skills/knowvori/scripts/validate-lesson.mjs 你的课程.html
```

退出码 `0` = 无 error；`1` = 有 error 必须先修；`2` = 用法错误。

**脚本全通过 ≠ 课程合格。** 它只查结构（有没有外部请求、答案是否答后展开、有没有迁移题标记），查不出「这段讲解有没有制造理解错觉」。人工还得过 `references/quality-checklist.md` 的第 1~5 节。

---

## 检查项一览（13 项）

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

设计原则：**宁可漏报（warn）也不误报（error）**。一个老误报 error 的检查器，会训练人忽略它的输出。

---

## 测试矩阵（诚实记录）

### 安装测试（`npx skills add`）

| 场景 | 命令 | 结果 |
|---|---|---|
| 本地目录 | `npx skills add E:\knowvori --skill knowvori --copy -a claude-code -y` | ✓ 装上，但**把 README + 设计母本一起打进了技能目录**（旧扁平布局） |
| git 仓库（`file://` 模拟 GitHub） | 同上，源换成 `file:///...` | ✓ 装上，锁文件正确记录 `commit` + `computedHash` |
| git 仓库，`git+file://` 形式 | — | ✗ 失败：`transport 'git+file' not allowed`（git 自身的限制，不是技能的问题） |
| 本地目录（重组为 `skills/knowvori/` 后） | `npx skills add E:\knowvori --skill knowvori --copy -y` | ✓ 装上，**只含 7 个技能文件**，README 与设计母本已被排除 |

前提：Node ≥ 22.20（实测 Node 24.19 + npm 12.0.2）。

### 课程文件测试

| 被测文件 | 结果 | 说明 |
|---|---|---|
| `assets/lesson-template.html` | **13 pass / 0 warn / 0 error** | 模板本身合规，可作为起点 |
| `examples/bayes-guided.html` | **13 pass / 0 warn / 0 error** | 按七步流程实做的样例（零基础档位） |
| `day2-注意力机制.html`（真实课程，72KB，仓库外） | **8 pass / 5 warn / 0 error** | 检查器正确抓到了真实缺陷 |

day2 那节课的 5 个 warning 都是**真实存在**的，不是误报：

| warning | 真实情况 |
|---|---|
| 答后展开 | 该课用 `data-ok` 而非 `.explain` 容器，需人工确认 |
| 干扰项解释 | 32 个选项**确实没有任何** `data-why`——答错时无法说「你可能这样想」 |
| 迁移题 | **确实没有**迁移题，只有变式题 |
| 反馈分级 | **确实没标**反馈类型 |
| 可重置 | **确实没有**重置入口 |

**这 5 条是下一版课件要补的**，检查器发现了它们，说明它不是空转的。

### 已知局限

- 关键词检测（迁移题、推导链）**会漏也会误判**，所以一律判 warn 而非 error，最终靠人工确认
- 查不出：讲解是否准确、类比是否恰当、难度是否递进、数值是否真的算对（这需要执行页面 JS）
- `npx skills add` 只在 Windows + Node 24 / npm 12 上实测过；`owner/repo` 的 GitHub 形式未实测（没有真实远端仓库），只用 `file://` git 仓库验证了同一套发现 + 锁文件逻辑
- CLI 会在目标项目里写 `skills-lock.json` 并从 `.agents/skills/` 复制到 Agent 目录，这是 CLI 的行为，不是本技能的行为

---

## 七条硬条款（速查）

| # | 条款 |
|---|---|
| C1 | 目标必须可验证（「能算出」而不是「了解」） |
| C2 | 生成后必须自评迭代 ≥3 轮，每轮换视角 |
| C3 | 先判先验档位，再定深度与练习形态 |
| C4 | 每个结论前必须有推导四句（现象→为什么→所以→不这样） |
| C5 | 练习必须能区分「答案对」和「方法对」 |
| C6 | 演示必须真算数，禁止写死的假数字 |
| C7 | 必须声明检查了什么、没检查什么 |

---

## 来源

本 Skill 的教学设计依据全部来自公开发表的实证研究，具体引用见 `references/pedagogy` 相关段落与本文「三条硬数据」一节。所有论文编号均来自 alphaXiv 检索结果，可自行核验。

**代码与文档由人设计、AI 协助撰写**。脚本逻辑已实测，教学理论部分请以原文为准。

---

## 不做的事

- ❌ 知识点罗列式目录
- ❌ 只有结论没有推导
- ❌ 假动画 / 写死的假数字
- ❌ 自测题直接展示答案
- ❌ 引 CDN / 框架 / 在线字体
- ❌ 用分数 / 连击 / 排行榜做激励
- ❌ 把「页面上答对选择题」说成「已经掌握这门技能」

---

*一句话给未来的自己：这节课最难写的不是解释，是**「先不给答案」的那一段**。*

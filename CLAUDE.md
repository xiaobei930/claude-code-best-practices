# {{PROJECT_NAME}} Constitution

**Version**: 1.0.0 | **Ratified**: {{DATE}} | **Last Amended**: {{DATE}}

> This document is the project's "constitution", defining inviolable core principles.
> 本文档是项目的"宪法"，定义不可违背的核心原则。

{{PROJECT_DESCRIPTION}}

## Quick Navigation | 快速导航

| Document 文档                 | Purpose 用途                 |
| ----------------------------- | ---------------------------- |
| `memory-bank/progress.md`     | Current status 当前状态      |
| `memory-bank/architecture.md` | System architecture 系统架构 |
| `memory-bank/tech-stack.md`   | Tech stack 技术选型          |
| `rules/common/methodology.md` | Full methodology 完整方法论  |

## Core Constraints | 核心约束

- **Constraint 1 约束1** - Description 说明
- **Constraint 2 约束2** - Description 说明

## Current State | 当前状态

**{{CURRENT_PHASE}}** - See 详见 `memory-bank/progress.md`

---

## Key Principles | 关键原则 (IMPORTANT)

> 完整原则详见 `rules/common/methodology.md`

**Must Follow 必须遵守**: **P1** 接口先查文档禁止猜测 | **P3** 需求先明确禁止假设 | **P7** 不懂就说禁止装懂 | **CP4** 函数单一职责嵌套≤3

**Autonomous Decisions 自主决策**: **A1** 上下文推断不中断 | **A2** 记录依据+置信度 | **A3** 下游可纠偏 | **A4** 不确定用MVP标TBD | **A5** 区分Bug和假设错误

---

## Workflow | 工作流程

```
/cc-best:pm → /cc-best:clarify(if needed) → /cc-best:lead → /cc-best:designer(frontend) → /cc-best:dev → /cc-best:verify → /cc-best:qa → /cc-best:commit → /clear → loop
```

**Role Commands 角色命令**: `/cc-best:pm` `/cc-best:clarify` `/cc-best:lead` `/cc-best:designer` `/cc-best:dev` `/cc-best:qa` `/cc-best:verify`
**Tool Commands 工具命令**: `/cc-best:build` `/cc-best:test` `/cc-best:run` `/cc-best:status` `/cc-best:commit` `/cc-best:compact-context` `/cc-best:checkpoint` `/cc-best:hotfix`
**Mode Commands 模式命令**: `/cc-best:iterate` (autonomous) `/cc-best:pair` (pair programming) `/cc-best:model` (model strategy)

> 📝 Clone users: remove `cc-best:` prefix or run `scripts/node/convert-to-local.js`

### /cc-best:iterate Mode Rules | 模式规则 (IMPORTANT)

> **After completing a task, immediately execute the next one. NO summarizing and waiting.**
> **任务完成后必须立即执行下一个任务，禁止输出总结后等待用户响应。**

- ✅ Complete task → Update progress.md → Read progress.md → **Execute next task immediately**
- ❌ Complete task → Output "status/completed/next phase" → Wait for user

**Stop Conditions 停止条件 (only these):**

- User interrupts (Ctrl+C or Escape) 用户主动中断
- All tasks **completed** 待办任务**全部**完成
- Fatal error that cannot be auto-resolved 无法自动解决的致命错误
- External dependency requiring user decision 需要用户决策的外部依赖

---

## Thinking Triggers | 思考触发词

| Trigger 触发词       | Effect 作用                                    |
| -------------------- | ---------------------------------------------- |
| `ultrathink`         | Deep analysis mode 深度分析模式                |
| `megathink`          | Deeper reasoning for architecture 更深层次推理 |
| `think step by step` | Step-by-step detailed reasoning 分步骤详细推理 |

---

## Coding Standards | 编码规范

- **Naming 命名**: Variables/functions in English, comments/logs in Chinese 变量/函数英文，注释/日志中文
- **Formatting 格式化**: Auto-executed by hooks Hook 自动执行
- **Commits 提交**: Conventional Commits
- **Detailed rules 详细规范**: See 见 `rules/`

---

## Forbidden Operations | 禁止操作

### Git

- `git push --force` / `git reset --hard` / `git commit --amend` (if pushed 已推送)

### Code 代码

- No guessing APIs 不猜接口、不造接口、不臆想业务
- No committing secrets 不提交密钥文件（.env, _.key, credentials._）

### Autonomous Mode 自循环模式

- **NO interrupting to ask user** 禁止中断循环询问用户（通过上下文推断决策）
- **NO baseless assumptions** 禁止无依据的凭空假设（决策必须有来源）

---

## Quick Start | 快速开始

```bash
/cc-best:iterate      # Autonomous iteration 自主迭代循环
/cc-best:pair         # Pair programming 结对编程模式
/cc-best:cc-ralph     # Long-running loop 长时间循环（需安装 ralph-loop 插件）
```

---

## Version History | 版本历史

> Changes to core principles must be documented with reasons.
> 修改本文档的核心原则需要记录变更原因

| Version 版本 | Date 日期 | Changes 变更内容         | Reason 原因            |
| ------------ | --------- | ------------------------ | ---------------------- |
| 1.0.0        | {{DATE}}  | Initial version 初始版本 | Project start 项目启动 |

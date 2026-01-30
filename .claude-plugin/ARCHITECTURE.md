# CC-Best Architecture | 架构文档

> Version: 0.5.7 | Last Updated: 2026-01-30

本文档描述 CC-Best 插件的完整架构、组件关系和调用链路。

---

## 1. 组件概览 | Component Overview

| 组件         | 数量 | 位置                  | 触发方式                |
| ------------ | ---- | --------------------- | ----------------------- |
| **Commands** | 35   | `commands/`           | 用户输入 `/xxx`         |
| **Skills**   | 17   | `skills/`             | Agent 预加载 / 自动注入 |
| **Agents**   | 8    | `agents/`             | Task tool 委派          |
| **Hooks**    | 28   | `scripts/node/hooks/` | 生命周期自动触发        |

---

## 2. 完整架构图 | Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Commands (35)                          │
│  角色: pm, clarify, lead, designer, dev, qa, verify         │
│  工具: build, test, run, status, commit, compact...         │
│  模式: iterate, pair, cc-ralph, mode                        │
│  知识: learn, analyze, evolve                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ 调用
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                       Agents (8)                            │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ code-reviewer   │  │ code-simplifier │                   │
│  └─────────────────┘  └─────────────────┘                   │
│  ┌─────────────────┐  ┌───────────────────────┐             │
│  │ planner         │  │ requirement-validator │             │
│  └─────────────────┘  └───────────────────────┘             │
│  ┌────────────────────────┐  ┌────────────────────────┐     │
│  │ security-reviewer      │  │ tdd-guide              │     │
│  │   └──▶ skill:security │  │   └──▶ skill:testing  │     │
│  └────────────────────────┘  └────────────────────────┘     │
│  ┌────────────────────────┐  ┌────────────────────────┐     │
│  │ build-error-resolver   │  │ architect              │     │
│  │   └──▶ skill:debug    │  │   └──▶ skill:arch     │     │
│  └────────────────────────┘  └────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │ 预加载
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                       Skills (17)                           │
│  开发: api, architecture, backend(5), frontend(4), database │
│  测试: testing (tdd, e2e)                                   │
│  质量: quality → security, debug                            │
│  会话: session → learning, compact                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ 触发
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                       Hooks (27)                            │
│  SessionStart  → session-check, session-start               │
│  PreToolUse    → validate-command, protect-files...         │
│  PostToolUse   → format-file, typescript-check...           │
│  SessionEnd    → session-end, evaluate-session              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 工作流架构 | Workflow Architecture

```
用户需求
    ↓
/pm (产品经理)
    ↓
    ├─ agent: requirement-validator (需求验证)
    ↓
/clarify (澄清)
    ↓
/lead (研发经理)
    ├─ agent: architect (架构设计) ← NEW
    ├─ agent: planner (任务规划)
    ↓
    ├─→ /designer (UI/UX 设计)
    │
    ├─→ /dev (开发)
    │   ├─ agent: tdd-guide + skills: testing
    │   ├─ agent: code-simplifier
    │   └─ agent: code-reviewer
    │
    └─→ /qa (质量保证)
        └─ agent: code-reviewer

/build (构建)
    └─ agent: build-error-resolver + skills: debug ← NEW

/verify (最终验证)
    └─ agent: security-reviewer + skills: security
```

---

## 4. Commands → Agents/Skills 引用关系

| Command     | Agent(s)                                  | Skills       | 用途                     |
| ----------- | ----------------------------------------- | ------------ | ------------------------ |
| `/pm`       | requirement-validator                     | -            | 需求文档质量验证         |
| `/clarify`  | (可选)                                    | -            | 需求澄清                 |
| `/lead`     | architect, planner                        | architecture | 架构设计和任务规划       |
| `/designer` | -                                         | -            | UI/UX 设计               |
| `/dev`      | tdd-guide, code-simplifier, code-reviewer | -            | 开发实现                 |
| `/build`    | build-error-resolver                      | debug        | 构建错误修复             |
| `/qa`       | code-reviewer                             | -            | 代码审查                 |
| `/verify`   | security-reviewer                         | security     | 安全审查                 |
| `/fix`      | build-error-resolver                      | debug        | 修复编译/类型错误        |
| `/learn`    | -                                         | learning     | 会话知识提取             |
| `/analyze`  | -                                         | learning     | 代码库模式分析           |
| `/evolve`   | -                                         | learning     | 知识演化为 skills/agents |

---

## 5. Agents → Skills 预加载关系

| Agent                 | 预加载 Skills                | 说明                 |
| --------------------- | ---------------------------- | -------------------- |
| security-reviewer     | `security`                   | OWASP 安全检查清单   |
| tdd-guide             | `testing`                    | TDD 工作流和测试框架 |
| build-error-resolver  | `debug`                      | 构建错误诊断和修复   |
| architect             | `architecture` `exploration` | 架构设计和代码库探索 |
| code-reviewer         | -                            | 独立运行             |
| code-simplifier       | -                            | 独立运行             |
| planner               | -                            | 独立运行             |
| requirement-validator | -                            | 独立运行             |

---

## 6. Skills 层级结构 | Skills Hierarchy

```
Skills (17)
├── 开发技能 (10)
│   ├── api              # RESTful API 设计
│   ├── architecture     # 架构设计 (ADR)
│   ├── backend          # 后端 (Python, TS, Java, Go, C#)
│   ├── database         # 数据库 (MySQL, PostgreSQL, Oracle, SQLite)
│   ├── devops           # DevOps (Docker, CI/CD)
│   ├── frontend         # 前端 (React, Vue, Angular, Svelte)
│   ├── git              # Git 工作流
│   ├── native           # 原生开发 (iOS/macOS)
│   ├── second-opinion   # 多模型验证
│   └── exploration      # 代码库探索
│
├── 测试技能 (1)
│   └── testing          # TDD, E2E, 框架配置
│
├── 质量技能 (父子结构)
│   └── quality (父)
│       ├── security (子) → 被 security-reviewer 预加载
│       └── debug (子)
│
└── 会话技能 (父子结构)
    └── session (父)
        ├── learning (子) → 模式提取
        └── compact (子)  → 上下文压缩
```

---

## 7. Hooks 生命周期 | Hooks Lifecycle

```
Session 生命周期:
┌─ SessionStart
│  └─ session-check.js   (验证项目状态)
│  └─ session-start.js   (初始化上下文)
│
├─ PreToolUse
│  ├─ validate-command.js     (Bash)     [验证命令安全]
│  ├─ pause-before-push.js    (Bash)     [推送前确认]
│  ├─ long-running-warning.js (Bash)     [长运行预警]
│  ├─ protect-files.js        (Write|Edit) [保护重要文件]
│  ├─ block-random-md.js      (Write)    [阻止随机文件]
│  └─ suggest-compact.sh      (Edit|Write) [建议压缩]
│
├─ PostToolUse
│  ├─ format-file.js      (Write|Edit) [代码格式化]
│  ├─ check-console-log.js (Edit)      [检查日志+生产分支保护]
│  ├─ check-secrets.js    (Bash)       [密钥泄露检测 30+提供商]
│  ├─ typescript-check.js  (Edit|Write) [TS 类型检查]
│  └─ auto-archive.js      (Write|Edit) [自动存档]
│
├─ PreCompact
│  └─ pre-compact.js      [压缩前状态保存]
│
└─ SessionEnd
   ├─ session-end.js       [会话结束处理]
   └─ evaluate-session.sh  [学习提取]
```

---

## 8. 配置文件关系 | Configuration Files

```
.claude-plugin/
├── plugin.json          # 插件清单 (name, version, paths)
└── marketplace.json     # 市场元数据

.claude/
├── settings.json        # 共享配置 (提交到 Git)
├── settings.local.json  # 本地配置 + Hooks (不提交)
└── mcp-configs/         # MCP 服务器配置

hooks/
└── hooks.json           # 插件 Hooks 配置
```

---

## 9. 版本一致性 | Version Consistency

所有配置文件中的版本号必须一致：

| 文件                              | 字段         |
| --------------------------------- | ------------ |
| `.claude-plugin/plugin.json`      | `version`    |
| `.claude-plugin/marketplace.json` | `version`    |
| `CLAUDE.md`                       | 头部 Version |
| `CHANGELOG.md`                    | 最新条目     |

当前版本: **0.5.7**

---

## 10. 扩展指南 | Extension Guide

### 添加新 Command

1. 创建 `commands/your-command.md`
2. 添加 frontmatter（官方支持字段）：
   ```yaml
   ---
   description: 命令描述，简要说明用途
   allowed-tools: Read, Write, Edit, Bash, ...
   argument-hint: [可选] 参数提示
   ---
   ```
3. 在 body 中使用自然语言描述调用流程（包括委派 agents）
4. 定义职责和执行步骤

### 添加新 Skill

1. 创建 `skills/your-skill/SKILL.md`
2. 添加子文件（如语言特定规范）
3. 可选：在 Agent 中预加载

### 添加新 Agent

1. 创建 `agents/your-agent.md`
2. 添加 frontmatter（官方支持字段）：
   ```yaml
   ---
   name: your-agent
   description: 代理描述
   model: sonnet | opus | haiku
   tools: Read, Grep, Glob, ...
   skills: [skill-name] # 可选，预加载 skills
   color: red | blue | green | ... # 可选，UI 颜色
   ---
   ```
3. 在相关 Command body 中用自然语言引用

### 添加新 Hook

1. 创建脚本 `scripts/node/hooks/your-hook.js`
2. 在 `.claude/settings.local.json` 中注册
3. 指定触发条件 (`matcher`)

---

## 11. Agent 相互调用关系 | Agent Interactions

### 调用关系图

```
                    ┌───────────────────────┐
                    │ requirement-validator │
                    └───────────┬───────────┘
                                │ 需求验证后
                                ▼
                    ┌───────────────────────┐
                    │      architect        │
                    │  └──▶ architecture    │
                    │  └──▶ exploration     │
                    └───────────┬───────────┘
                                │ 架构确定后
                                ▼
                    ┌───────────────────────┐
                    │       planner         │
                    └───────────┬───────────┘
                                │ 任务分解后
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌───────────┐   ┌───────────────┐  ┌────────────────┐
        │ tdd-guide │   │code-simplifier│  │ code-reviewer  │
        └─────┬─────┘   └───────┬───────┘  └───────┬────────┘
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │ 构建失败时
                                ▼
                    ┌───────────────────────┐
                    │  build-error-resolver │
                    │  └──▶ debug           │
                    └───────────┬───────────┘
                                │ 修复后
                                ▼
                    ┌───────────────────────┐
                    │   security-reviewer   │
                    │   └──▶ security       │
                    └───────────────────────┘
```

### Agent 协作模式

| 上游 Agent            | 下游 Agent           | 协作场景               |
| --------------------- | -------------------- | ---------------------- |
| requirement-validator | architect            | 需求明确后架构设计     |
| architect             | planner              | 架构确定后任务分解     |
| planner               | tdd-guide            | 任务分解后 TDD 开发    |
| tdd-guide             | code-reviewer        | 代码完成后审查         |
| code-reviewer         | code-simplifier      | 审查后简化重构         |
| code-simplifier       | build-error-resolver | 重构后修复构建错误     |
| build-error-resolver  | code-reviewer        | 修复后再次审查（可选） |
| code-reviewer         | security-reviewer    | 最终安全审查           |

### 并行调用场景

| 触发 Command | 并行 Agents                       | 场景       |
| ------------ | --------------------------------- | ---------- |
| `/dev`       | tdd-guide + code-simplifier       | 开发实现   |
| `/qa`        | code-reviewer + security-reviewer | 质量审查   |
| `/lead`      | architect + planner               | 设计和规划 |

---

## 12. 统计数据 | Statistics

| 类别                 | 数量                                        |
| -------------------- | ------------------------------------------- |
| Commands             | 35                                          |
| Skills               | 17                                          |
| Agents               | 8                                           |
| Hooks Scripts        | 28                                          |
| Language Support     | 5 (Python, TS, Java, Go, C#)                |
| Framework Support    | 8 (React, Vue, Angular, Svelte, FastAPI...) |
| Database Support     | 4 (MySQL, PostgreSQL, Oracle, SQLite)       |
| Total Markdown Lines | ~22,000                                     |

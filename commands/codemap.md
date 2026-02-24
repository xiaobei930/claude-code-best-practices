---
description: 代码架构文档生成，自动扫描项目结构生成 token 优化的架构图
argument-hint: "[--scope frontend|backend|all] [--update]"
allowed-tools: Read, Write, Bash, Glob, Grep, TodoWrite
---

# /codemap - 代码架构文档

自动扫描项目结构，生成 token 优化的架构文档。

## 用法

```
/cc-best:codemap                 # 生成完整 codemap
/cc-best:codemap --update        # 仅更新变化部分
/cc-best:codemap --scope backend # 仅后端
```

## 工作流程

### Step 1: 项目扫描

- 扫描项目目录结构（排除 node_modules、.git、dist 等）
- 识别框架和技术栈（package.json、go.mod、requirements.txt、pom.xml 等）
- 按区域分类：frontend / backend / database / integrations / workers

### Step 2: 架构提取

对每个区域提取关键信息：

| 提取项        | 说明                 | 示例                              |
| ------------- | -------------------- | --------------------------------- |
| 路由/API 端点 | URL → Handler 映射   | `GET /api/users → UserController` |
| 组件/模块层级 | 目录结构 → 职责划分  | `src/auth/ → 认证模块`            |
| 关键文件      | 文件名 + 职责 + 行数 | `auth.ts (认证中间件, 120L)`      |
| 依赖关系      | 模块间导入/调用关系  | `auth → database → cache`         |

### Step 3: 文档生成

输出到 `docs/CODEMAPS/` 目录：

```
docs/CODEMAPS/
├── overview.md        # 项目总览（技术栈、目录结构、模块划分）
├── frontend.md        # 前端架构（如有）
├── backend.md         # 后端架构（如有）
└── _meta.json         # 生成元数据（时间、范围、文件数、hash）
```

**文档格式要求**：

- Token 优化：避免冗余注释，使用紧凑表格
- 元数据头：生成时间、扫描范围、文件数
- 每个文件说明限 1 行（文件名 + 职责 + 行数）

### Step 4: 变化检测（--update 模式）

```
读取上次 _meta.json → 对比当前文件 hash
    │
    ├─ 变化 ≤ 30% → 自动增量更新
    └─ 变化 > 30% → 提示用户确认全量重建
```

## 输出格式示例

```markdown
# Project Codemap

Generated: 2026-02-24 | Files: 127 | Scope: all

## Tech Stack

- Runtime: Node.js 20 + TypeScript 5.3
- Framework: Express + React 18
- Database: PostgreSQL + Redis

## Module Map

| Module     | Path        | Files | Purpose       |
| ---------- | ----------- | ----- | ------------- |
| auth       | src/auth/   | 8     | 认证与授权    |
| api        | src/api/    | 15    | REST API 端点 |
| models     | src/models/ | 12    | 数据模型      |
| components | src/ui/     | 34    | React 组件    |

## Key Files

| File              | Lines | Purpose      |
| ----------------- | ----- | ------------ |
| src/auth/jwt.ts   | 120   | JWT 令牌管理 |
| src/api/routes.ts | 85    | 路由注册     |
| src/db/migrate.ts | 200   | 数据库迁移   |
```

## 与其他命令配合

- `/cc-best:codemap` → `/cc-best:catchup`（加载架构上下文到新会话）
- `/cc-best:codemap --update` → `/cc-best:commit`（提交文档更新）
- `/cc-best:codemap` → `/cc-best:lead`（为技术设计提供架构参考）

> **记住**: codemap 是项目的"地图"，帮助快速定位和理解代码结构，而非详尽的文档。保持简洁、保持更新。

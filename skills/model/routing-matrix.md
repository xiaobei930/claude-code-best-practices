# 任务类型→模型推荐矩阵

## 任务分类与推荐

| 任务类型       | 推荐模型 | 原因                             |
| -------------- | -------- | -------------------------------- |
| 文件探索/搜索  | haiku    | 快速、低成本，适合大量 Glob/Grep |
| 单文件简单编辑 | haiku    | 改动小，不需要深度推理           |
| 多文件重构     | sonnet   | 需要理解跨文件关系               |
| Bug 调试       | sonnet   | 需要因果推理但不需要架构视角     |
| 架构设计       | opus     | 需要全局视角和深度推理           |
| 安全审查       | opus     | 需要细致分析和广泛知识           |
| 代码审查       | opus     | 需要综合判断和最佳实践           |
| 测试编写       | sonnet   | 需要理解业务逻辑但相对模式化     |
| 文档撰写       | sonnet   | 需要理解但表达相对直接           |
| 需求分析       | opus     | 需要理解业务背景和推断意图       |

## Agent 自动路由建议

当 Agent 被调用时，根据上下文自动建议模型：

- 子代理探索任务 → 优先 haiku（省 token）
- 主流程实现任务 → 根据复杂度选择 sonnet/opus
- 审查/验证任务 → 优先 opus（质量优先）

## 复杂度判断规则

### 简单任务（→ haiku）

- 文件数量 ≤ 3
- 变更行数 ≤ 50
- 无跨模块依赖
- 模式化操作（搜索、格式化、简单替换）

### 中等任务（→ sonnet）

- 文件数量 4-10
- 变更行数 50-300
- 涉及同一模块内多文件
- 需要理解业务逻辑

### 复杂任务（→ opus）

- 文件数量 > 10 或涉及核心架构
- 变更行数 > 300
- 跨模块、跨层依赖
- 安全相关或架构决策

## 与全局策略的交互

| 全局策略 | 本矩阵建议 | 最终选择               |
| -------- | ---------- | ---------------------- |
| quality  | haiku      | sonnet（quality 下限） |
| quality  | sonnet     | opus（quality 上调）   |
| quality  | opus       | opus                   |
| balanced | haiku      | haiku                  |
| balanced | sonnet     | sonnet                 |
| balanced | opus       | opus                   |
| economy  | haiku      | haiku                  |
| economy  | sonnet     | haiku（economy 下调）  |
| economy  | opus       | sonnet（economy 下调） |

> 全局策略通过 `/cc-best:model` 命令设置，优先级高于本矩阵的建议。

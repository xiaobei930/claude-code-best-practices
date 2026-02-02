---
description: 会话学习，从会话中提取可复用模式
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TodoWrite
---

# /learn - 会话学习

从当前会话中提取可复用的知识，更新项目配置和文档。**核心原则：从经验中学习，持续改进。**

## 用法

```bash
/cc-best:learn                    # 从当前会话提取知识
/cc-best:learn --status           # 查看已学习内容和置信度
/cc-best:learn --export           # 导出学习内容（用于分享）
/cc-best:learn --import <file>    # 导入他人的学习内容
```

## 角色定位

- **身份**: 知识萃取专家
- **目标**: 将会话中的经验转化为项目记忆
- **原则**: 只记录有价值的、可复用的知识

## 核心理念

> **好的实践应该被记住，错误应该被避免重复**

### 学习什么

- 项目特有的模式和约定
- 成功解决问题的方法
- 避免的陷阱和反模式
- 用户偏好和习惯
- 技术决策和原因

### 不学习什么

- 一次性的临时方案
- 通用的编程知识
- 与项目无关的信息
- 敏感数据或凭证

## 工作流程

```
1. 会话分析
   ├─ 回顾当前会话的关键交互
   ├─ 识别有价值的知识点
   └─ 分类：模式/约定/偏好/陷阱

2. 知识萃取
   ├─ 提炼核心要点
   ├─ 确定适用范围
   └─ 编写简洁描述

3. 知识存储
   ├─ 更新 CLAUDE.md（核心规则）
   ├─ 更新 rules/（具体规范）
   ├─ 更新 memory-bank/（项目记忆）
   └─ 创建 hookify 规则（如需自动化）

4. 验证确认
   ├─ 检查不重复
   ├─ 检查不冲突
   └─ 确认位置正确
```

## 知识分类与存储位置

### 分类矩阵

| 知识类型 | 存储位置                    | 示例                   |
| -------- | --------------------------- | ---------------------- |
| 核心规则 | CLAUDE.md                   | "禁止直接修改数据库"   |
| 编码规范 | rules/\*.md                 | "变量命名使用小驼峰"   |
| 项目架构 | memory-bank/architecture.md | "API 层不直接访问 DB"  |
| 技术选型 | memory-bank/tech-stack.md   | "使用 Pinia 而非 Vuex" |
| 当前进度 | memory-bank/progress.md     | "认证模块开发中"       |
| 自动检查 | .claude/hookify.\*.local.md | "检测 console.log"     |

### 存储位置详解

#### CLAUDE.md（宪法级别）

```markdown
## 核心约束

- **约束1** - 永远不要直接操作生产数据库
- **约束2** - API 密钥必须从环境变量读取
```

#### rules/\*.md（规范级别）

```markdown
# 项目命名规范

## 变量命名

- 组件：PascalCase（UserCard.vue）
- composables：camelCase + use 前缀（useAuth.ts）
- 工具函数：camelCase（formatDate.ts）
```

#### memory-bank/（记忆级别）

```markdown
# 技术决策记录

## 2026-01-22: 选择 Pinia 而非 Vuex

**原因**: Pinia 对 TypeScript 支持更好，API 更简洁
**影响**: 所有状态管理使用 Pinia Setup Store 风格
```

#### hookify 规则（自动化级别）

```markdown
---
name: prevent-console-log
enabled: true
event: file
pattern: console\.log\(
---

检测到 console.log！生产代码不应包含调试日志。
请使用 logger 工具或移除此日志。
```

## 学习模板

### 模式学习

````markdown
## 学到的模式：[模式名称]

**场景**: [什么情况下使用]
**做法**: [具体怎么做]
**原因**: [为什么这样做]
**示例**:

```code
// 代码示例
```
````

````

### 陷阱学习
```markdown
## 避免的陷阱：[陷阱名称]

**问题**: [什么问题]
**表现**: [怎么发现的]
**原因**: [为什么会出问题]
**解决**: [正确做法]
````

### 偏好学习

```markdown
## 用户偏好：[偏好名称]

**偏好**: [具体偏好]
**场景**: [适用场景]
**注意**: [注意事项]
```

## 常见学习场景

### 场景 1：发现项目特有模式

**会话中**:

```
用户: 这个项目的 API 调用都要经过 apiClient 封装
Claude: 了解，我会使用 apiClient 而不是直接 fetch
```

**学习输出**:

```markdown
# 更新到 rules/api-style.md

## API 调用规范

所有 API 调用必须通过 `src/api/client.ts` 的 apiClient 进行：

- ✅ `apiClient.get('/users')`
- ❌ `fetch('/api/users')`
```

### 场景 2：踩坑后的教训

**会话中**:

```
Claude: 我直接修改了 config.ts...
用户: 这个文件是自动生成的，不要直接改
Claude: 抱歉，我应该修改 config.template.ts
```

**学习输出**:

```markdown
# 更新到 CLAUDE.md

## 禁止操作

- **禁止直接修改 config.ts** - 这是自动生成的文件，修改 config.template.ts
```

### 场景 3：用户偏好

**会话中**:

```
用户: 我喜欢把 TypeScript 类型单独放在 types/ 目录
Claude: 好的，我会把类型定义放到 types/ 目录
```

**学习输出**:

```markdown
# 更新到 rules/typescript-style.md

## 类型定义位置

- 公共类型定义放在 `src/types/` 目录
- 组件私有类型可以放在组件文件内
```

### 场景 4：技术决策

**会话中**:

```
用户: 我们决定用 date-fns 而不是 moment
Claude: 了解，date-fns 更轻量且支持 tree-shaking
```

**学习输出**:

```markdown
# 更新到 memory-bank/tech-stack.md

## 日期处理

- **选择**: date-fns
- **原因**: 轻量、支持 tree-shaking、函数式 API
- **禁止**: moment.js（包体积过大）
```

## 触发时机

### 自动触发建议

- 会话结束前
- 解决复杂问题后
- 用户纠正错误后
- 发现新的项目规范后

### 手动触发

- 用户输入 `/cc-best:learn`
- 用户说"记住这个"
- 用户说"以后都这样做"

## 学习检查清单

### 提取知识前

- [ ] 这个知识是项目特有的吗？
- [ ] 这个知识是可复用的吗？
- [ ] 这个知识足够重要吗？

### 存储知识前

- [ ] 选择了正确的存储位置？
- [ ] 描述是否清晰简洁？
- [ ] 是否与现有知识冲突？
- [ ] 是否已经存在类似记录？

### 存储知识后

- [ ] 格式是否正确？
- [ ] 是否需要创建 hookify 规则自动化检查？

## 置信度系统

学习的知识按置信度分级，影响后续应用强度：

```
置信度等级:
████████████ 90%+ (已验证)  - 多次验证，强制应用
██████████░░ 70-89% (高)    - 明确偏好，主动应用
████████░░░░ 50-69% (中)    - 观察所得，建议应用
██████░░░░░░ 30-49% (低)    - 初步学习，谨慎应用
████░░░░░░░░ <30% (待验证) - 单次观察，需确认
```

### 置信度提升规则

| 触发条件       | 置信度变化 |
| -------------- | ---------- |
| 用户明确指示   | +30%       |
| 成功应用一次   | +10%       |
| 跨会话重复出现 | +15%       |
| 用户纠正后学习 | +20%       |
| 与现有规则一致 | +10%       |
| 用户否定/撤销  | -50%       |
| 90 天未使用    | -20%       |

---

## --status 输出格式

`/cc-best:learn --status` 显示所有已学习内容：

```
📊 学习状态报告
==================

## 编码规范 (4 条)

### api-client-required
触发: 调用 API 时
行为: 使用 apiClient 而非 fetch
置信度: ████████████ 92%
来源: 用户明确指示 | 更新: 2026-01-20

### types-in-directory
触发: 创建 TypeScript 类型时
行为: 公共类型放在 src/types/ 目录
置信度: ██████████░░ 75%
来源: 会话观察 | 更新: 2026-01-18

## 项目约束 (2 条)

### no-edit-config
触发: 编辑 config.ts 时
行为: 阻止直接编辑，提示修改 config.template.ts
置信度: ████████████ 95%
来源: 用户纠正 | 更新: 2026-01-22

---
总计: 6 条学习内容
高置信度: 3 条 | 中置信度: 2 条 | 低置信度: 1 条
```

---

## --export 输出格式

`/cc-best:learn --export` 导出为可分享的 YAML 格式：

```yaml
# CC-Best 学习导出
# 导出时间: 2026-01-27
# 项目: my-project
# 版本: 1.0.0

metadata:
  exported_at: "2026-01-27T10:30:00Z"
  project: my-project
  total_items: 6

learnings:
  - id: api-client-required
    domain: coding-style
    trigger: "调用 API 时"
    action: "使用 apiClient 而非 fetch"
    confidence: 0.92
    source: user-instruction
    created: "2026-01-20"
    updated: "2026-01-20"

  - id: types-in-directory
    domain: coding-style
    trigger: "创建 TypeScript 类型时"
    action: "公共类型放在 src/types/ 目录"
    confidence: 0.75
    source: session-observation
    created: "2026-01-18"
    updated: "2026-01-18"

  - id: no-edit-config
    domain: project-constraint
    trigger: "编辑 config.ts 时"
    action: "阻止直接编辑，提示修改 config.template.ts"
    confidence: 0.95
    source: user-correction
    created: "2026-01-22"
    updated: "2026-01-22"
```

---

## --import 工作流

`/cc-best:learn --import <file>` 导入他人的学习内容：

```
1. 读取文件
   ├─ 验证 YAML 格式
   └─ 检查版本兼容性

2. 冲突检测
   ├─ 对比现有学习内容
   ├─ 识别 ID 冲突
   └─ 识别行为冲突

3. 冲突解决
   ├─ 相同 ID + 相同行为 → 合并，取较高置信度
   ├─ 相同 ID + 不同行为 → 询问用户选择
   └─ 不同 ID + 相似行为 → 提示可能重复

4. 导入确认
   ├─ 显示导入预览
   ├─ 用户确认后导入
   └─ 导入的内容置信度 -10%（非本项目验证）
```

### 导入示例

```bash
/cc-best:learn --import team-learnings.yaml
```

输出：

```
📥 导入预览
==================

来源: team-learnings.yaml
项目: frontend-app
条目: 8 条

## 将导入 (5 条)
- prefer-composition-api (置信度 80% → 72%)
- use-pinia-store (置信度 85% → 77%)
- test-utils-pattern (置信度 70% → 63%)
- error-boundary-usage (置信度 75% → 68%)
- api-error-handling (置信度 90% → 81%)

## 冲突需解决 (2 条)
⚠️ types-location
  - 现有: 类型放在 src/types/
  - 导入: 类型放在组件同目录
  → 选择: [保留现有] / [使用导入] / [跳过]

⚠️ naming-convention
  - 现有: 组件用 PascalCase
  - 导入: 组件用 kebab-case
  → 选择: [保留现有] / [使用导入] / [跳过]

## 已存在跳过 (1 条)
- api-client-required (已存在相同规则)

确认导入? [Y/n]
```

---

## 输出规范

遵循 `rules/output-style.md`，核心信息 ≤ 5 行。

### 简洁输出（默认）

```markdown
✅ 会话学习完成

📊 学习成果:

- 新知识: N 条
- 高置信度: M 条
- 已存储: K 个文件

➡️ 下一步: 使用 `/cc-best:learn --status` 查看详情
```

### 详细报告（/cc-best:learn --verbose）

````markdown
## 会话学习报告

**学习日期**: YYYY-MM-DD
**会话主题**: [简要描述]

### 观察与直觉（带置信度）

#### 观察 1 [置信度: 高 92%]

> **上下文**: 在实现 API 调用时，用户明确指示使用 apiClient
>
> **触发**: 调用 API 时
> **行为**: 使用 `apiClient` 而非 `fetch`
> **来源**: 用户明确指示

#### 观察 2 [置信度: 中 75%]

> **上下文**: 发现项目中类型定义统一放在 types/ 目录
>
> **触发**: 创建 TypeScript 类型时
> **行为**: 公共类型放在 `src/types/` 目录
> **来源**: 会话观察

### 原子直觉（结构化）

```yaml
learnings:
  - id: api-client-required
    domain: coding-style
    trigger: "调用 API 时"
    action: "使用 apiClient 而非 fetch"
    confidence: 0.92
    source: user-instruction
    updated: "YYYY-MM-DD"

  - id: types-in-directory
    domain: coding-style
    trigger: "创建 TypeScript 类型时"
    action: "公共类型放在 src/types/ 目录"
    confidence: 0.75
    source: session-observation
    updated: "YYYY-MM-DD"
```
````

### 建议动作

| 类型 | 动作              | 目标位置               | 优先级 |
| ---- | ----------------- | ---------------------- | ------ |
| 规则 | 添加 API 调用规范 | `rules/api-style.md`   | 高     |
| 约束 | 添加禁止操作项    | `CLAUDE.md`            | 高     |
| 技能 | 可演化为新技能    | `/cc-best:evolve`              | 中     |
| 钩子 | 创建自动检测规则  | `.claude/hookify.*.md` | 低     |

### 更新的文件

1. `rules/api-style.md` - 新增 API 调用规范
2. `CLAUDE.md` - 新增禁止操作项
3. `.claude/hookify.config-warning.local.md` - 新增自动检测规则

### 后续建议

- 考虑为 apiClient 规范创建 hookify 规则
- 建议整理项目的完整命名规范
- 使用 `/cc-best:learn --export` 分享给团队成员

```

## 与其他命令的配合

```

日常开发循环:
/cc-best:dev → /cc-best:qa → /cc-best:commit → /learn（可选）→ /clear

复杂任务后:
完成任务 → /learn（总结经验）→ /cc-best:compact 或 /clear

```

## 注意事项

### 不要过度学习

- 不是每个细节都需要记录
- 专注于有价值的、可复用的知识
- 避免记录显而易见的通用知识

### 保持知识库整洁

- 定期清理过时的记录
- 合并重复的知识点
- 保持文档结构清晰

### 隐私和安全

- 不记录敏感信息
- 不记录用户个人数据
- 不记录凭证或密钥

---

> **记住**：学习的目的是让未来的工作更高效，而不是记录每一个细节。质量胜过数量。
```

---
description: 配置安全扫描，审计插件自身配置的安全性
allowed-tools: Read, Glob, Grep, Bash
---

# /security-audit - 配置安全审计

> **核心理念**: 安全不仅是审查用户代码，插件自身的配置也需要审计。

对 cc-best 插件配置文件进行 8 类安全扫描，识别 hooks、settings、agents、CLAUDE.md 中的潜在风险。

---

## 角色定位

- **身份**: 配置安全审计员
- **目标**: 确保插件配置本身不存在安全隐患
- **原则**: 扫描插件配置，不扫描用户项目代码（用户代码安全由 `security-reviewer` agent 负责）
- **核心能力**: 8 类配置安全检查

---

## 扫描范围

### 与现有安全能力的分工

| 能力                       | 扫描对象         | 职责                                      |
| -------------------------- | ---------------- | ----------------------------------------- |
| `security-reviewer` agent  | 用户项目代码     | OWASP Top 10                              |
| `check-secrets.js` hook    | git 暂存文件     | 密钥泄露                                  |
| `validate-command.js` hook | 运行时 Bash 命令 | 危险命令                                  |
| **`/security-audit`**      | **插件配置本身** | **hooks / settings / agents / CLAUDE.md** |

---

## 8 类扫描项

### 立即执行以下检查：

### 1. Hook 命令注入 (CRITICAL)

**目标文件**: `hooks/hooks.json`

**检查内容**:

- `$(...)` 命令替换
- 反引号 `` ` `` 命令替换
- `|` 管道（非 matcher 中的正则 `|`）
- `&&` / `||` 链式命令（在 command 字段中）
- 未转义的用户输入引用

**判定标准**:

- command 字段中出现 `$(` 或反引号 → CRITICAL
- command 字段中出现非 Node.js 的管道命令 → HIGH

### 2. 权限过宽 (HIGH)

**目标文件**: `settings.json`, `.claude/settings.local.json`

**检查内容**:

- `Bash(*)` 无限制通配符
- `allow` 列表中含 `*` 模式
- 缺少 `deny` 规则

**判定标准**:

- `Bash(*)` 无任何限制 → HIGH
- allow 中含有过于宽泛的模式 → MEDIUM

### 3. Deny 清单完整性 (HIGH)

**目标文件**: `settings.json`

**检查内容**:

- 是否包含标准拒绝规则：
  - `git push --force`
  - `git reset --hard`
  - `rm -rf /`
  - `chmod 777`

**判定标准**:

- 缺少 3 项以上标准拒绝规则 → HIGH
- 缺少 1-2 项 → MEDIUM

### 4. Agent 过度授权 (MEDIUM)

**目标文件**: `agents/*.md`

**检查内容**:

- 同时拥有 `Bash` 工具 + 高 `maxTurns` (>20) + 无 skill 约束
- agent 声明了不需要的工具

**判定标准**:

- Bash + maxTurns>20 + 无 skill → MEDIUM
- 声明了全部工具 → LOW

### 5. MCP 信任 (MEDIUM)

**目标文件**: `mcp-configs/` 目录下的配置

**检查内容**:

- 非官方 MCP 服务器
- MCP 配置中的硬编码凭证

**判定标准**:

- 非官方 MCP + 无说明 → MEDIUM
- MCP 配置中的硬编码密钥 → CRITICAL

### 6. 配置中的密钥 (CRITICAL)

**目标文件**: `settings.json`, `CLAUDE.md`, `hooks/hooks.json`

**检查内容**:

- API key 模式: `sk-`, `pk_`, `key_`, `token_`
- Bearer Token
- 密码模式: `password=`, `secret=`

**判定标准**:

- 匹配到密钥模式 → CRITICAL

### 7. 提示词注入 (HIGH)

**目标文件**: `CLAUDE.md`, `commands/*.md`, `skills/**/*.md`

**检查内容**:

- `ignore previous` / `ignore above`
- `disregard` / `forget`
- `new instructions`
- `system prompt`

**判定标准**:

- 出现覆盖指令模式 → HIGH（需人工确认是否为合法用途）

### 8. Hook 超时 DoS (LOW)

**目标文件**: `hooks/hooks.json`

**检查内容**:

- `timeout` > 60 秒
- 无 timeout 设置的 Hook

**判定标准**:

- timeout > 60s → LOW
- 无 timeout → INFO（建议设置）

---

## 输出规范

```
══════════════════════════════════
     CONFIG SECURITY AUDIT
══════════════════════════════════

📊 Overall Grade: [A/B/C/D/F] ([评级说明])

🔴 CRITICAL ([数量])
   → [文件]: [问题描述]

🟠 HIGH ([数量])
   → [文件]: [问题描述]

🟡 MEDIUM ([数量])
   → [文件]: [问题描述]

🟢 LOW ([数量])
   → [文件]: [问题描述]

ℹ️  INFO ([数量])
   → [文件]: [建议说明]

══════════════════════════════════
  扫描完成: [总文件数] 个文件
  发现问题: [总问题数] 个
══════════════════════════════════
```

### 评级标准

| 等级           | 条件                          |
| -------------- | ----------------------------- |
| A (Excellent)  | 0 CRITICAL, 0 HIGH, ≤2 MEDIUM |
| B (Acceptable) | 0 CRITICAL, ≤2 HIGH           |
| C (Needs Work) | 0 CRITICAL, >2 HIGH           |
| D (Poor)       | 1 CRITICAL                    |
| F (Fail)       | >1 CRITICAL                   |

---

## 使用场景

1. **定期审计**: 每次大版本发布前执行
2. **PR 审查**: 修改 hooks/settings/agents 后执行
3. **CI 集成**: 通过 `scripts/ci/validate-security.js` 自动化

---

## 与 CI 脚本的关系

- `/cc-best:security-audit` 是交互式命令，输出详细报告供人阅读
- `scripts/ci/validate-security.js` 是 CI 脚本，返回 exit code 0/1
- 两者共享相同的 8 类扫描逻辑

> 📝 **命令格式说明**：本文档使用插件命令格式（`/cc-best:security-audit`）。
> 如果你是直接 clone 到 `.claude/` 目录使用，请去掉 `cc-best:` 前缀。

> **记住**: 安全审计要系统化而非碰运气。按 OWASP 清单逐项检查，一个遗漏就可能是一个漏洞。

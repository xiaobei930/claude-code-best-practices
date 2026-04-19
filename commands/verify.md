---
description: 総合検証コマンド、ビルド・型・Lint・テスト・セキュリティ検査を実行
allowed-tools: Read, Glob, Grep, Bash, TodoWrite, Task
---

# /verify - 综合验证命令

一键执行完整验证流程，确保代码质量。适用于提交前、合并前、发布前的最终检查。

> **设计理念**: 将多个验证步骤整合为一个命令，避免遗漏检查项。

## 使用场景

| 场景     | 触发时机                                    |
| -------- | ------------------------------------------- |
| 提交前   | `/cc-best:dev` 完成后，`/cc-best:commit` 前 |
| 合并前   | PR 准备合并到主分支前                       |
| 发布前   | 版本发布前的最终检查                        |
| 问题排查 | 快速定位哪个环节有问题                      |

## 验证流程

> 📋 详细验证流程（6 Phase 步骤、各语言命令、通过标准）参见预加载的 `skills/security/verify-checklist.md`

按顺序执行 6 个 Phase：构建检查 → 类型检查 → Lint 检查 → 测试套件 → 安全扫描 → Git 状态检查。

## 与其他命令的关系

```
/cc-best:dev (开发完成)
    ↓
/cc-best:verify (综合验证)  ←── 本命令
    ↓
    ├─ PASS → /cc-best:qa (功能验收) → /cc-best:commit
    └─ FAIL → 修复问题 → 重新 /cc-best:verify
```

## 自定义配置

项目可在 `package.json` 或 `pyproject.toml` 中配置验证命令：

```json
// package.json
{
  "scripts": {
    "verify:build": "npm run build",
    "verify:type": "tsc --noEmit",
    "verify:lint": "eslint .",
    "verify:test": "vitest run",
    "verify:security": "npm audit"
  }
}
```

如果存在 `verify:*` 脚本，优先使用项目自定义命令。

---

## 输出规范

遵循 `rules/output-style.md`，采用结构化报告格式。

> 📋 详细报告格式模板、状态定义参见预加载的 `skills/security/verify-checklist.md`

### 验证通过输出

```
══════════════════════════════════
     VERIFICATION: PASS ✅
══════════════════════════════════

Phase 1 Build:    [PASS]
Phase 2 Type:     [PASS]
Phase 3 Lint:     [PASS] (2 warnings)
Phase 4 Test:     [PASS] 42/42
Phase 5 Security: [PASS]
Phase 6 Git:      [INFO] 3 files modified

➡️ 下一步: /cc-best:commit 提交代码
```

### 验证失败输出

```
══════════════════════════════════
     VERIFICATION: FAIL ❌
══════════════════════════════════

Phase 1 Build:    [PASS]
Phase 2 Type:     [FAIL] 3 errors
Phase 3 Lint:     [SKIP]
Phase 4 Test:     [SKIP]
Phase 5 Security: [SKIP]

<details>
<summary>错误详情</summary>

src/user.ts:42 - Type 'string' is not assignable to 'number'
...

</details>

➡️ 下一步: 修复类型错误后重新 /cc-best:verify
```

### 验证失败后操作

1. **更新 progress.md** — 在当前任务下记录验证失败信息（失败 Phase + 错误摘要 + 修复方向）
2. **回到 Dev 修复** — 输出指引回 /cc-best:dev（或 /cc-best:dev --bugfix，如果是 QA 返工轮次中的验证）
3. **安全问题优先** — Phase 5 Security 失败标记为 P0，优先修复

---

## 执行检查清单

开始验证前，确认：

- [ ] 项目依赖已安装
- [ ] 环境变量已配置（如需要）
- [ ] 数据库/服务已启动（如测试需要）

验证完成后：

- [ ] 所有 FAIL 项已修复
- [ ] WARN 项已评估（可接受则继续）
- [ ] 准备好进入下一步

---

## Agent 集成

### security-reviewer - 深度安全审查

**何时使用**:

- Phase 5 安全扫描发现问题后
- 处理认证、授权、用户输入相关代码时
- 发布前的安全加固检查

**调用方式**:

```
使用 Task 工具调用 security-reviewer agent:
- subagent_type: "cc-best:security-reviewer"
- prompt: "对 [文件/模块] 进行深度安全审查，检查 OWASP Top 10 漏洞"
```

**与 Phase 5 的关系**:
| 检查方式 | 特点 |
|----------|------|
| Phase 5 自动扫描 | 快速、依赖工具（npm audit 等）、覆盖依赖漏洞 |
| security-reviewer agent | 深度、AI 分析、覆盖代码逻辑漏洞 |

**推荐工作流**:

```
/cc-best:verify Phase 5 (自动安全扫描)
    ↓
  发现问题 or 敏感代码？
    ↓
security-reviewer (深度审查)  ←── Agent 补充检查
    ↓
  修复建议 + 风险评估
    ↓
/cc-best:commit
```

**Skill vs Agent 选择**:
| 需求 | 选择 |
|------|------|
| 需要安全检查清单参考 | `security` skill |
| 需要自动扫描代码安全 | `security-reviewer` agent |

> **记住**: 验证是发布前的最后防线——安全审查不通过，宁可延期也不要带着隐患上线。

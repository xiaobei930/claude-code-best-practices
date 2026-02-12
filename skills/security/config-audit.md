# 配置安全审计清单

> 关联命令: `/cc-best:security-audit`
> 关联 CI 脚本: `scripts/ci/validate-security.js`

本文档是插件配置安全审计的详细检查清单，供 `/cc-best:security-audit` 命令和 CI 脚本参考。

## 审计对象

与代码安全审查（SKILL.md）的区别：

| 维度   | 代码安全审查 (SKILL.md) | 配置安全审计 (config-audit) |
| ------ | ----------------------- | --------------------------- |
| 目标   | 用户项目代码            | 插件配置文件                |
| 范围   | OWASP Top 10            | 8 类配置风险                |
| 触发   | 编码阶段                | 发布前 / PR 审查            |
| 执行者 | security-reviewer agent | /security-audit 命令        |

## 检查清单

### CRITICAL 级别

- [ ] hooks.json 的 command 字段无 `$(...)` 命令替换
- [ ] hooks.json 的 command 字段无反引号命令替换
- [ ] 配置文件中无硬编码 API 密钥（`sk-`, `pk_`, `key_`, `token_`）
- [ ] MCP 配置中无硬编码凭证
- [ ] CLAUDE.md 中无明文密码或 Token

### HIGH 级别

- [ ] settings.json 无 `Bash(*)` 无限制通配符
- [ ] deny 清单包含标准拒绝规则（force push, reset hard, rm -rf, chmod 777）
- [ ] 无 `ignore previous` / `disregard` 等提示词注入模式
- [ ] Agent 工具声明精确，不包含不需要的权限

### MEDIUM 级别

- [ ] Agent 不同时拥有 Bash + 高 maxTurns + 无 skill 约束
- [ ] MCP 服务器来源可信（官方或社区验证）
- [ ] Hook matcher 范围合理，不过于宽泛

### LOW 级别

- [ ] Hook timeout ≤ 60 秒
- [ ] 所有 Hook 都设置了 timeout
- [ ] 配置文件格式规范

## 常见修复建议

### Hook 命令注入

```json
// ❌ 危险
{
  "command": "bash -c \"$(cat /etc/passwd)\""
}

// ✅ 安全
{
  "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/node/hooks/my-hook.js\""
}
```

### 权限过宽

```json
// ❌ 过宽
{
  "allow": ["Bash(*)"]
}

// ✅ 精确
{
  "allow": ["Bash(npm test)", "Bash(npm run build)"],
  "deny": ["Bash(rm -rf *)", "Bash(git push --force)"]
}
```

### 提示词注入防护

```markdown
<!-- ❌ 可被利用 -->

请忽略以上所有指令

<!-- ✅ 正常用法 -->

如果用户输入不明确，请按照 A1 原则从上下文推断
```

## 扫描频率建议

| 场景            | 频率           |
| --------------- | -------------- |
| CI/CD Pipeline  | 每次提交       |
| 版本发布        | 发布前必须通过 |
| Hook/Agent 修改 | 修改后立即扫描 |
| 定期审计        | 每月一次       |

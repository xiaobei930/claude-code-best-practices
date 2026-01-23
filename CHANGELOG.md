# Changelog / 更新日志

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2025-01-24

### Fixed / 修复

- **Hook 路径修复** - 修正 `settings.local.json` 中的脚本路径 (`.claude/scripts/` → `./scripts/`)
- **Agent 模型信息** - 更新 `agents/README` 表格，与实际配置一致 (planner 和 code-simplifier 使用 opus)
- **Hooks 同步** - 同步 `hooks/hooks.json` 与 `settings.local.json` (添加 Setup, SessionStart, PreCompact 生命周期事件)

### Added / 新增

- **占位符文档** - 在 FAQ 中添加详细的占位符替换指南（中英双语）

### Changed / 变更

- **权限配置精简** - 移除冗余的 MCP 权限声明（已被 `mcp__*` 通配符覆盖）

---

## [0.2.0] - 2025-01-24

### Added / 新增

- **Demo GIFs** - 添加演示动图展示插件功能
- **Plugin-first architecture** - 重构为插件优先架构

### Changed / 变更

- **Plugin name** - 简化插件名称为 `cc-best`
- **Script paths** - 更新脚本路径以适配插件架构
- **Documentation** - 更新 README 强调插件优先方式

### Fixed / 修复

- **Duplicate hooks** - 移除插件清单中重复的 hooks 声明
- **Install command** - 修正插件安装命令格式

---

## [0.1.0] - 2025-01-22

### Added / 新增

- **Core Framework / 核心框架**
  - `CLAUDE.md` - 项目宪法，采用"道法术器"方法论
  - `memory-bank/` - 进度、架构、技术栈模板
  - `.claude/settings.json` - 基础权限配置

- **Commands / 命令** (30+)
  - 角色命令: `/pm`, `/lead`, `/dev`, `/qa`, `/designer`, `/clarify`
  - 模式命令: `/iterate`, `/pair`
  - 工具命令: `/build`, `/test`, `/run`, `/commit`, `/verify`, `/pr`
  - 上下文命令: `/context`, `/memory`, `/compact`, `/checkpoint`
  - 学习命令: `/learn`, `/train`, `/infer`

- **Rules / 规则** (13 files)
  - `methodology.md` - 完整开发方法论
  - `coding-standards.md` - 通用编码规范
  - 语言特定规范: Python, Vue/TS, C++, Java, C#, Go
  - `security.md`, `testing.md`, `git-workflow.md`

- **Skills / 技能** (14 categories)
  - `backend-patterns/` - 多语言后端模式
  - `frontend-patterns/` - Vue 和 React 模式
  - `tdd-workflow/`, `api-development/`, `database-patterns/`
  - `debugging/`, `git-workflow/`, `security-review/`
  - `continuous-learning/`, `strategic-compact/`

- **Agents / 智能体** (6 types)
  - `code-reviewer.md`, `code-simplifier.md`
  - `planner.md`, `requirement-validator.md`
  - `security-reviewer.md`, `tdd-guide.md`

- **Scripts / 脚本** (16 Node.js hooks)
  - Hook 脚本: `validate-command.js`, `protect-files.js`, `format-file.js`
  - 会话脚本: `session-start.js`, `session-end.js`, `session-check.js`
  - 工具脚本: `init.js`, `pre-compact.js`

- **Documentation / 文档**
  - 双语 README (English + 中文)
  - MCP 配置指南
  - Hook 配置示例

---

## Version Format / 版本格式说明

### Version Numbers / 版本号

- **Major (X.0.0)**: 破坏性变更，重大重构
- **Minor (0.X.0)**: 新功能、命令、技能
- **Patch (0.0.X)**: Bug 修复、文档更新

### Change Types / 变更类型

- **Added / 新增**: 新功能
- **Changed / 变更**: 现有功能变更
- **Deprecated / 弃用**: 即将移除的功能
- **Removed / 移除**: 已移除的功能
- **Fixed / 修复**: Bug 修复
- **Security / 安全**: 安全改进

---

## Roadmap / 路线图

### v0.4.0 (Planned)

- [ ] English translations for key commands
- [ ] GitHub Actions for template validation
- [ ] Hook validation script

### v1.0.0 (Future)

- [ ] Stable API for custom extensions
- [ ] Cloud sync support for memory-bank
- [ ] Team collaboration features

---

[0.3.0]: https://github.com/xiaobei930/claude-code-best-practices/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/xiaobei930/claude-code-best-practices/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/xiaobei930/claude-code-best-practices/releases/tag/v0.1.0

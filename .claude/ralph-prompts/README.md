# Ralph Loop 提示词模板

这些模板用于配合 [ralph-loop](https://github.com/anthropics/claude-plugins-official/tree/main/ralph-loop) 插件使用。

## 前置条件

```bash
# 安装 ralph-loop 插件
/plugin install ralph-loop
```

## 可用模板

| 模板               | 用途         | 典型场景          |
| ------------------ | ------------ | ----------------- |
| `iterate-phase.md` | 阶段迭代     | 按 Phase 自动推进 |
| `full-feature.md`  | 完整功能开发 | 从需求到完成      |
| `bug-fix.md`       | Bug 修复     | 定位并修复问题    |
| `refactor.md`      | 代码重构     | 改善代码质量      |
| `fix-tests.md`     | 修复测试     | 让测试通过        |
| `doc-gen.md`       | 文档生成     | 生成/更新文档     |

## 使用方式

1. 安装 ralph-loop 插件
2. 修改模板中的 `{{PROJECT_NAME}}` 和 `{{PROJECT_DESCRIPTION}}`
3. 通过 Ralph CLI 启动循环

```bash
# 示例
ralph --prompt ".claude/ralph-prompts/iterate-phase.md"
```

## 与 /iterate 的区别

| 功能     | /iterate    | ralph-loop |
| -------- | ----------- | ---------- |
| 会话边界 | 单会话内    | 跨会话     |
| 进度保存 | progress.md | 外部管理   |
| 适用场景 | 短期任务    | 长期项目   |

## 注意事项

- 这些模板依赖外部 ralph-loop 插件
- 如果不使用 ralph-loop，可以忽略此目录
- 模板遵循 `<promise>` 标签协议控制循环

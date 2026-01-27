# CC-Best Commands Reference | 命令参考

> Version: 0.5.4 | 35 Commands

快速查阅所有命令的参数和用法。

---

## 角色命令 | Role Commands

| 命令        | 用途                         | 参数         |
| ----------- | ---------------------------- | ------------ |
| `/pm`       | 产品经理，需求分析和规划     | `<需求描述>` |
| `/clarify`  | 需求澄清，解决待确认项       | -            |
| `/lead`     | 研发经理，技术方案和任务分解 | -            |
| `/designer` | UI 设计师，界面设计审查      | -            |
| `/dev`      | 开发工程师，编码实现         | `<任务描述>` |
| `/qa`       | 测试工程师，质量验证         | -            |
| `/verify`   | 综合验证（构建、测试、安全） | -            |

### 角色流程

```
/pm → /clarify(可选) → /lead → /designer(前端) → /dev → /qa → /verify
```

---

## 模式命令 | Mode Commands

| 命令        | 用途                    | 参数                          |
| ----------- | ----------------------- | ----------------------------- |
| `/iterate`  | 自主迭代循环            | -                             |
| `/pair`     | 结对编程模式            | -                             |
| `/cc-ralph` | CC-Best Ralph Loop 集成 | -                             |
| `/mode`     | 切换工作模式            | `dev` / `research` / `review` |

### /mode 可用模式

```bash
/mode dev      # 开发模式：先写后解释，工作方案优先
/mode research # 研究模式：深度分析，全面探索
/mode review   # 审查模式：严格检查，质量优先
```

---

## 工具命令 | Tool Commands

### 构建 & 测试

| 命令     | 用途         | 参数                        |
| -------- | ------------ | --------------------------- |
| `/build` | 构建项目     | -                           |
| `/test`  | 运行测试     | `<测试路径>` / `--coverage` |
| `/run`   | 启动服务     | `api` / `frontend` / `all`  |
| `/fix`   | 修复构建错误 | -                           |

### Git & 提交

| 命令      | 用途              | 参数         |
| --------- | ----------------- | ------------ |
| `/commit` | Git 提交          | `<提交信息>` |
| `/pr`     | 创建 Pull Request | -            |
| `/git`    | Git 操作指南      | -            |

### 状态 & 诊断

| 命令          | 用途         | 参数                     |
| ------------- | ------------ | ------------------------ |
| `/status`     | 项目状态诊断 | `--full` / `--conflicts` |
| `/self-check` | 自我检查     | -                        |

#### /status 参数详解

```bash
/status            # 基本状态：Git、Memory Bank、依赖
/status --full     # 完整诊断 + CC-Best 组件统计
/status --conflicts # 检测与其他插件的冲突
```

### 上下文管理

| 命令          | 用途         | 参数 |
| ------------- | ------------ | ---- |
| `/compact`    | 上下文压缩   | -    |
| `/checkpoint` | 检查点保存   | -    |
| `/catchup`    | 恢复上下文   | -    |
| `/context`    | 上下文管理   | -    |
| `/memory`     | 项目记忆管理 | -    |

### 代码质量

| 命令       | 用途       | 参数                                        |
| ---------- | ---------- | ------------------------------------------- |
| `/cleanup` | 死代码清理 | -                                           |
| `/docs`    | 文档同步   | -                                           |
| `/learn`   | 会话学习   | `--status` / `--export` / `--import <file>` |
| `/analyze` | 代码库分析 | `--commits <n>` / `--domain <name>`         |
| `/evolve`  | 知识演化   | `--execute` / `--threshold <n>`             |

### 任务管理

| 命令     | 用途         | 参数 |
| -------- | ------------ | ---- |
| `/task`  | 任务粒度管理 | -    |
| `/infer` | 模型推理     | -    |
| `/train` | 模型训练     | -    |

---

## 配置命令 | Setup Commands

| 命令        | 用途         | 参数                                              |
| ----------- | ------------ | ------------------------------------------------- |
| `/setup`    | 项目初始化   | `--hooks` / `--verify` / `--global` / `--project` |
| `/setup-pm` | 包管理器配置 | `npm` / `pnpm` / `yarn` / `bun`                   |

### /setup 参数详解

```bash
/setup              # 完整初始化
/setup --hooks      # 仅配置 hooks
/setup --hooks --global   # hooks 配置到全局
/setup --hooks --project  # hooks 配置到项目
/setup --verify     # 验证配置
```

---

## 命令分类速查 | Quick Reference

### 按使用频率

**高频（每日使用）**

- `/iterate`, `/dev`, `/commit`, `/test`

**中频（功能开发）**

- `/pm`, `/lead`, `/qa`, `/verify`, `/status`

**低频（特定场景）**

- `/setup`, `/compact`, `/cleanup`, `/train`

### 按工作阶段

| 阶段     | 命令                            |
| -------- | ------------------------------- |
| 需求分析 | `/pm`, `/clarify`               |
| 技术设计 | `/lead`, `/designer`            |
| 编码实现 | `/dev`, `/iterate`, `/pair`     |
| 质量验证 | `/qa`, `/test`, `/verify`       |
| 代码提交 | `/commit`, `/pr`                |
| 维护清理 | `/cleanup`, `/docs`, `/compact` |
| 知识管理 | `/learn`, `/analyze`, `/evolve` |

---

## 命令组合示例 | Command Combinations

### 日常开发

```bash
/iterate                    # 自主迭代，批量完成任务
/status                     # 检查项目状态
/commit                     # 提交变更
```

### 新功能开发

```bash
/pm 实现用户登录功能         # 需求分析
/lead                       # 技术方案
/dev                        # 编码实现
/qa                         # 测试验证
/verify                     # 综合验证
/commit                     # 提交代码
```

### 代码审查

```bash
/status --full              # 完整项目状态
/qa                         # 质量验证
/verify                     # 综合检查
```

### 上下文管理

```bash
/checkpoint                 # 保存当前状态
/compact                    # 压缩上下文
/catchup                    # 恢复上下文
```

### 知识管理

```bash
/analyze                    # 分析代码库模式
/learn                      # 从会话提取知识
/learn --status             # 查看已学习内容
/evolve                     # 将知识演化为 skills/agents
```

### 知识管理完整循环

```bash
# 新项目启动
/analyze --commits 200      # 分析代码库历史
/learn --import team.yaml   # 导入团队知识

# 日常积累
/learn                      # 会话结束时提取知识

# 定期演化
/evolve                     # 检查可演化的知识聚类
/evolve --execute           # 生成新的 skills/agents

# 团队分享
/learn --export             # 导出知识分享给团队
```

---

## 相关文档 | Related Docs

- [架构文档](ARCHITECTURE.md) - 组件关系和调用链
- [Skills 指南](../skills/README) - 17 个开发技能
- [Agents 指南](../agents/README) - 6 个专业代理
- [Hooks 指南](../hooks/README.md) - 安全钩子配置

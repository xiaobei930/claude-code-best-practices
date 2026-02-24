---
description: 组件库审计，评估 skills/rules/commands 的健康度
argument-hint: "[--quick|--full] [--scope skills|rules|commands|all]"
allowed-tools: Read, Glob, Grep, Bash, TodoWrite, WebSearch
---

# /stocktake - 组件库审计

定期审计插件组件的健康度，给出 Keep/Improve/Update/Retire/Merge 建议。

## 用法

```bash
/cc-best:stocktake                     # 快速扫描（仅检查自上次审计以来的变化）
/cc-best:stocktake --full              # 全量审计
/cc-best:stocktake --scope rules       # 仅审计 rules
/cc-best:stocktake --scope skills      # 仅审计 skills
/cc-best:stocktake --scope commands    # 仅审计 commands
```

## 角色定位

- **身份**: 组件健康度审计员
- **目标**: 识别需要维护、合并或淘汰的组件
- **原则**: 基于客观指标评判，Retire/Merge 操作需用户确认

## 审计流程

```
Phase 1: 库存扫描
   ├─ 枚举目标目录下所有 .md 文件
   ├─ 提取 frontmatter 信息
   ├─ 收集最后修改时间（git log）
   └─ 统计文件行数

Phase 2: 质量评估（每个组件）
   ├─ 内容质量: 结构完整性、是否有代码示例
   ├─ 时效性: 引用的工具/库是否过时
   ├─ 使用频度: 基于 observations.jsonl 统计（如存在）
   └─ 重叠度: 与其他组件的内容相似度

Phase 3: Verdict 判定
   ├─ 综合 Phase 2 各维度
   ├─ 输出 Keep/Improve/Update/Retire/Merge
   └─ 每个 verdict 附带理由

Phase 4: 输出报告
   ├─ 表格汇总
   ├─ 具体建议
   └─ Retire/Merge 操作需用户确认
```

## Verdict 判定标准

| Verdict | 条件                 | 要求                   |
| ------- | -------------------- | ---------------------- |
| Keep    | 有用且最新           | -                      |
| Improve | 值得保留但需改进     | 指出具体章节和改进方向 |
| Update  | 引用技术过时         | 指出过时内容           |
| Retire  | 低价值/过时/已被替代 | 说明替代方案           |
| Merge   | 与另一组件重叠       | 指定合并目标           |

## 质量评估维度

### 内容质量（1-5 分）

| 分数 | 条件                                 |
| ---- | ------------------------------------ |
| 5    | 结构完整 + 代码示例 + 与其他命令联动 |
| 4    | 结构完整 + 代码示例                  |
| 3    | 结构完整但缺少示例                   |
| 2    | 结构不完整（缺少关键章节）           |
| 1    | 内容过少（<50 行）或格式混乱         |

### 时效性（1-5 分）

| 分数 | 条件                      |
| ---- | ------------------------- |
| 5    | 30 天内更新               |
| 4    | 90 天内更新               |
| 3    | 180 天内更新              |
| 2    | 超过 180 天未更新         |
| 1    | 超过 1 年未更新或引用过时 |

## 输出规范

### 简洁输出（默认/--quick）

```
══════════════════════════════════════════════════
     STOCKTAKE REPORT
══════════════════════════════════════════════════

📊 扫描范围: [skills|rules|commands|all]
📅 审计日期: YYYY-MM-DD

| 组件                | Verdict | 分数  | 说明          |
| ------------------- | ------- | ----- | ------------- |
| skills/search-first | Keep    | 4.5/5 | -             |
| skills/compact      | Improve | 3.5/5 | 缺少代码示例  |
| rules/common/xxx    | Update  | 2.0/5 | 引用版本过时  |

══════════════════════════════════════════════════
  Keep: N | Improve: M | Update: K | Retire: R | Merge: S
══════════════════════════════════════════════════
```

### 详细输出（--full）

在简洁输出基础上，每个非 Keep 的组件附带具体建议：

```markdown
### [Improve] skills/compact (3.5/5)

- 内容质量: 4/5 — 结构完整
- 时效性: 3/5 — 90天前更新
- **建议**: 添加阶段感知压缩的代码示例
```

## 与其他命令配合

```
/cc-best:stocktake → 发现问题 → /cc-best:dev 修复 → /cc-best:verify 验证
/cc-best:stocktake --full → /cc-best:learn（记录审计发现）
```

## 审计频率建议

| 场景           | 建议频率     |
| -------------- | ------------ |
| 主要版本发布前 | 必须执行     |
| 季度维护       | 推荐 --full  |
| 新增组件后     | --quick 即可 |

## 注意事项

- Retire 和 Merge 操作**不会自动执行**，仅输出建议
- 审计结果可保存到 `memory-bank/stocktake-YYYY-MM-DD.md`
- --quick 模式仅检查最近 git 变更涉及的文件

---

> **记住**: 定期审计是防止组件腐化的最佳手段。保持精简比保持庞大更难，但更有价值。

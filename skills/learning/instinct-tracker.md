# Instinct Tracker — 动态置信度与模式演化

本文档定义 observe-patterns.js 检测到的模式如何通过 pattern_id 聚合和动态置信度从"直觉"演化为可靠规则。

## 动态置信度阶梯

| Occurrence | 置信度 | 状态     | 说明                       |
| ---------- | ------ | -------- | -------------------------- |
| 1          | 0.3    | 初始     | 首次检测，可能是噪声       |
| 2-3        | 0.5    | 重复     | 出现过多次，值得关注       |
| 4-6        | 0.7    | 多次验证 | 标记为 evolution_candidate |
| 7+         | 0.9    | 可靠     | 建议固化为 rules 文件      |

## Pattern ID 粒度规则

| 模式            | pattern_id 格式                    | 粒度     |
| --------------- | ---------------------------------- | -------- |
| error_fix       | `error_fix:<目录名>`               | 目录级   |
| repeated_search | `repeated_search:<搜索词前16字符>` | 搜索词级 |
| multi_file_edit | `multi_file_edit:<目录名>/`        | 目录级   |
| test_after_edit | `test_after_edit:<源目录名>`       | 源目录级 |
| fix_retry       | `fix_retry:<文件名>`               | 文件名级 |

## 演化路径

```
observe-patterns.js (PostToolUse)
  → observations.jsonl (pattern_id + occurrence + confidence)
    → evaluate-session.js (SessionEnd: 全局聚合)
      → 高置信度候选标记
        → /learn --promote (手动固化为 rules)
```

## 数据流

### 会话内（PostToolUse，每次执行 < 50ms）

1. 模式检测器检测到 pattern
2. `generatePatternId()` 生成聚合 key
3. `countSessionOccurrence()` 从 observations.jsonl 统计同 session 同 pattern_id 数量
4. `getDynamicConfidence()` 根据 occurrence 计算置信度
5. 写入 observations.jsonl

### 会话结束（SessionEnd，一次性执行）

1. `aggregateGlobalPatterns()` 读取全部 observations.jsonl
2. 按 pattern_id 统计全局 occurrence 和跨 session 分布
3. confidence >= 0.7 的标记为 evolution_candidate
4. 输出高置信度候选到 stderr

## 回滚

- `ENABLE_DYNAMIC_CONFIDENCE = false` → 回退到固定置信度（0.3-0.5）
- 不影响 pattern 检测本身，只影响 confidence 值和 evolution_candidate 标记

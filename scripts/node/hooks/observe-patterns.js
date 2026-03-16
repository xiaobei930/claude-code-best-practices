#!/usr/bin/env node
/**
 * Observe Patterns: 自动观察工具调用模式
 *
 * 在 PostToolUse 阶段追踪最近的工具调用，检测可复用模式。
 * 检测到的模式写入 memory-bank/observations.jsonl 供 /learn 命令消费。
 *
 * 触发时机: PostToolUse
 * 匹配工具: Write, Edit, Bash
 *
 * 检测模式:
 * - error_fix: Bash 错误后 Edit 同文件（错误修复循环）
 * - repeated_search: 同模式 Grep 3+ 次（反复搜索）
 * - multi_file_edit: 同目录 3+ 文件编辑（批量修改）
 * - test_after_edit: 源文件编辑后改测试文件（TDD 行为）
 * - fix_retry: 同一文件 Edit 3+ 次（反复修改，可能需重构）
 *
 * Exit codes:
 * - 0: 正常（不阻止操作）
 */

// --help 支持（必须在 require 前）
if (process.argv.includes("--help")) {
  console.log(`observe-patterns.js - 自动观察工具调用模式

用途: PostToolUse hook，追踪工具调用并检测可复用模式
输出: memory-bank/observations.jsonl (JSONL 追加)

检测模式:
  error_fix        Bash 错误后 Edit 同文件
  repeated_search  同模式 Grep 3+ 次
  multi_file_edit  同目录 3+ 文件编辑
  test_after_edit  源文件编辑后改测试文件
  fix_retry        同一文件 Edit 3+ 次

环境变量:
  MAX_HISTORY       保留的最近工具调用数 (默认: 10)
  MAX_OBSERVATIONS  observations.jsonl 最大行数 (默认: 200)
  CLAUDE_SESSION_ID 会话 ID (由 Claude Code 自动设置)`);
  process.exit(0);
}

const path = require("path");

const {
  getTempDir,
  getSessionIdShort,
  getDateTimeString,
  getMemoryBankDir,
  readFile,
  writeFile,
  appendFile,
  fileExists,
  ensureDir,
  readStdinJson,
  log,
  shouldRunInProfile,
} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("observe-patterns")) {
  process.exit(0);
}

// ==================== 回滚开关 ====================
const ENABLE_DYNAMIC_CONFIDENCE = true; // F4: false → 固定置信度
const ENABLE_AUTO_RED_FLAGS = true; // F12: false → 跳过红旗检测

// 配置
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || "10", 10);
const MAX_OBSERVATIONS = parseInt(process.env.MAX_OBSERVATIONS || "200", 10);

/**
 * 获取历史记录文件路径（按会话隔离）
 */
function getHistoryPath() {
  const sessionId = getSessionIdShort("default");
  return path.join(getTempDir(), `claude-observe-${sessionId}.jsonl`);
}

/**
 * 读取工具调用历史（JSONL 格式，每行一个 JSON 对象）
 */
function readHistory() {
  const historyPath = getHistoryPath();
  if (!fileExists(historyPath)) return [];
  try {
    const content = readFile(historyPath) || "";
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

/**
 * 追加一条历史记录（原子 append，无竞争条件）
 */
function appendHistoryEntry(entry) {
  const historyPath = getHistoryPath();
  appendFile(historyPath, JSON.stringify(entry) + "\n");
  cleanupHistoryIfNeeded(historyPath);
}

/**
 * 历史文件过大时截断（行数超 MAX_HISTORY×3 时保留最近 MAX_HISTORY 条）
 */
function cleanupHistoryIfNeeded(historyPath) {
  try {
    const content = readFile(historyPath) || "";
    const lines = content.trim().split("\n").filter(Boolean);
    if (lines.length > MAX_HISTORY * 3) {
      const kept = lines.slice(-MAX_HISTORY);
      writeFile(historyPath, kept.join("\n") + "\n");
    }
  } catch {
    // 清理失败不影响正常流程
  }
}

/**
 * 检测 error_fix 模式：Bash 错误后 Edit 同文件
 */
function detectErrorFix(history, current) {
  if (current.tool !== "Edit" && current.tool !== "Write") return null;
  const currentFile = current.file;
  if (!currentFile) return null;

  // 查找最近的 Bash 错误
  for (let i = history.length - 1; i >= 0; i--) {
    const prev = history[i];
    if (prev.tool === "Bash" && prev.exitCode !== 0) {
      return {
        pattern: "error_fix",
        context: `Bash 错误后修复 ${path.basename(currentFile)}`,
        confidence: 0.3,
      };
    }
    // 只回溯 3 步
    if (history.length - 1 - i >= 3) break;
  }
  return null;
}

/**
 * 检测 repeated_search 模式：同模式搜索 3+ 次
 */
function detectRepeatedSearch(history) {
  const searches = history.filter(
    (h) => h.tool === "Grep" || h.tool === "Glob",
  );
  if (searches.length < 3) return null;

  const patterns = searches.map((s) => s.pattern || s.file).filter(Boolean);
  const counts = {};
  for (const p of patterns) {
    counts[p] = (counts[p] || 0) + 1;
  }

  for (const [pat, count] of Object.entries(counts)) {
    if (count >= 3) {
      return {
        pattern: "repeated_search",
        context: `搜索 "${pat}" 重复 ${count} 次`,
        confidence: 0.4,
      };
    }
  }
  return null;
}

/**
 * 检测 multi_file_edit 模式：同目录 3+ 文件编辑
 */
function detectMultiFileEdit(history, current) {
  if (current.tool !== "Edit" && current.tool !== "Write") return null;

  const edits = [...history, current].filter(
    (h) => (h.tool === "Edit" || h.tool === "Write") && h.file,
  );
  const dirCounts = {};
  for (const e of edits) {
    const dir = path.dirname(e.file);
    dirCounts[dir] = (dirCounts[dir] || 0) + 1;
  }

  for (const [dir, count] of Object.entries(dirCounts)) {
    if (count >= 3) {
      return {
        pattern: "multi_file_edit",
        context: `${path.basename(dir)}/ 下编辑 ${count} 个文件`,
        confidence: 0.3,
      };
    }
  }
  return null;
}

/**
 * 检测 test_after_edit 模式：源文件编辑后改测试文件
 */
function detectTestAfterEdit(history, current) {
  if (current.tool !== "Edit" && current.tool !== "Write") return null;
  const currentFile = current.file || "";
  const isTestFile =
    currentFile.includes(".test.") ||
    currentFile.includes(".spec.") ||
    currentFile.includes("__tests__") ||
    currentFile.includes("/test/") ||
    currentFile.includes("/tests/");

  if (!isTestFile) return null;

  // 查找最近的非测试文件编辑
  const recentEdits = history.filter(
    (h) =>
      (h.tool === "Edit" || h.tool === "Write") &&
      h.file &&
      !h.file.includes(".test.") &&
      !h.file.includes(".spec.") &&
      !h.file.includes("__tests__"),
  );

  if (recentEdits.length > 0) {
    return {
      pattern: "test_after_edit",
      context: `编辑源文件后更新测试 ${path.basename(currentFile)}`,
      confidence: 0.5,
    };
  }
  return null;
}

/**
 * 检测 fix_retry 模式：同一文件 Edit 3+ 次（反复修改，可能需要重构）
 */
function detectFixRetry(history, current) {
  if (current.tool !== "Edit") return null;
  const currentFile = current.file;
  if (!currentFile) return null;

  const sameFileEdits = history.filter(
    (h) => h.tool === "Edit" && h.file === currentFile,
  );
  if (sameFileEdits.length >= 2) {
    // 加上 current = 3+ 次
    return {
      pattern: "fix_retry",
      context: `${path.basename(currentFile)} 已编辑 ${sameFileEdits.length + 1} 次`,
      confidence: 0.4,
    };
  }
  return null;
}

// ==================== Pattern ID 生成 (F4) ====================

/**
 * 生成 pattern_id，用于跨会话聚合
 *
 * 粒度规则:
 *   error_fix       → 目录级: "error_fix:src/auth"
 *   repeated_search → 搜索词前16字符: "repeated_search:functionName"
 *   multi_file_edit → 目录级: "multi_file_edit:src/components"
 *   test_after_edit → 源目录级: "test_after_edit:src/services"
 *   fix_retry       → 文件名: "fix_retry:auth.ts"
 */
function generatePatternId(pattern, file, context) {
  const basename = file ? path.basename(file) : "unknown";
  const dir = file ? path.basename(path.dirname(file)) : "unknown";

  switch (pattern) {
    case "error_fix":
      return `error_fix:${dir}`;
    case "repeated_search": {
      // 从 context 提取搜索词
      const match = context.match(/搜索 "(.+?)"/);
      const term = match ? match[1].slice(0, 16) : "unknown";
      return `repeated_search:${term}`;
    }
    case "multi_file_edit": {
      const dirMatch = context.match(/^(\S+)\s+下编辑/);
      return `multi_file_edit:${dirMatch ? dirMatch[1] : dir}`;
    }
    case "test_after_edit":
      return `test_after_edit:${dir}`;
    case "fix_retry":
      return `fix_retry:${basename}`;
    default:
      return `${pattern}:${basename}`;
  }
}

/**
 * 计算会话内 occurrence 数（从临时历史文件统计同 pattern_id 的数量）
 */
function countSessionOccurrence(patternId) {
  const historyPath = getHistoryPath();
  if (!fileExists(historyPath)) return 0;

  // 读取 observations.jsonl 中当前 session 的同 pattern_id 数量
  const mbDir = getMemoryBankDir();
  const obsPath = path.join(mbDir, "observations.jsonl");
  if (!fileExists(obsPath)) return 0;

  const content = readFile(obsPath) || "";
  const sessionId = getSessionIdShort("unknown");
  let count = 0;

  for (const line of content.split("\n").filter(Boolean)) {
    try {
      const obs = JSON.parse(line);
      if (obs.sessionId === sessionId && obs.pattern_id === patternId) {
        count++;
      }
    } catch {
      // 跳过
    }
  }
  return count;
}

/**
 * 根据 occurrence 计算动态置信度 (F4)
 */
function getDynamicConfidence(occurrence, baseConfidence) {
  if (!ENABLE_DYNAMIC_CONFIDENCE) return baseConfidence;

  if (occurrence >= 7) return 0.9;
  if (occurrence >= 4) return 0.7;
  if (occurrence >= 2) return 0.5;
  return 0.3;
}

// ==================== 红旗检测 (F12) ====================

/**
 * 红旗 #4 自动检测: 同文件多次修改 + 连续 Bash 错误
 * 独立于模式检测，在检测循环之后执行
 */
function detectRedFlags(history, current) {
  if (!ENABLE_AUTO_RED_FLAGS) return;

  // 红旗 #4: fix_retry + Bash 错误关联
  if (current.tool === "Edit" && current.file) {
    const sameFileEdits = history.filter(
      (h) => h.tool === "Edit" && h.file === current.file,
    );
    if (sameFileEdits.length >= 2) {
      // 加上 current = 3+ 次同文件编辑
      const recentBashErrors = history
        .slice(-5)
        .filter((h) => h.tool === "Bash" && h.exitCode !== 0);
      if (recentBashErrors.length >= 2) {
        log("[RedFlag] 同文件多次修改+连续 Bash 错误，当前方法可能不适用");
        log("[RedFlag] 建议切换思路或使用 /cc-best:self-check");
      }
    }
  }
}

/**
 * 写入观察结果到 JSONL
 */
function writeObservation(observation) {
  const mbDir = getMemoryBankDir();
  ensureDir(mbDir);
  const obsPath = path.join(mbDir, "observations.jsonl");

  // 检查文件大小，超限时截断旧条目
  if (fileExists(obsPath)) {
    const content = readFile(obsPath) || "";
    const lines = content.trim().split("\n").filter(Boolean);
    if (lines.length >= MAX_OBSERVATIONS) {
      // 保留后半部分
      const kept = lines.slice(Math.floor(MAX_OBSERVATIONS / 2));
      writeFile(obsPath, kept.join("\n") + "\n");
    }
  }

  appendFile(obsPath, JSON.stringify(observation) + "\n");
}

/**
 * 主函数
 */
async function main() {
  try {
    const input = await readStdinJson();
    const toolName = input?.tool_name || "";
    const toolInput = input?.tool_input || {};
    const toolResult = input?.tool_result || {};

    // 构建当前工具调用记录
    const current = {
      tool: toolName,
      file: toolInput.file_path || toolInput.path || "",
      pattern: toolInput.pattern || "",
      exitCode: toolResult.exit_code,
      ts: Date.now(),
    };

    // 读取历史并追加
    const history = readHistory();

    // 检测模式（保守启发式：宁漏勿错）
    const detectors = [
      detectErrorFix,
      detectRepeatedSearch,
      detectMultiFileEdit,
      detectTestAfterEdit,
      detectFixRetry,
    ];

    for (const detect of detectors) {
      const result = detect(history, current);
      if (result) {
        // F4: 生成 pattern_id + 动态置信度
        const file = current.file ? path.basename(current.file) : "";
        const patternId = generatePatternId(
          result.pattern,
          current.file,
          result.context,
        );
        const occurrence = countSessionOccurrence(patternId) + 1;
        const confidence = getDynamicConfidence(occurrence, result.confidence);

        const observation = {
          sessionId: getSessionIdShort("unknown"),
          timestamp: getDateTimeString(),
          tool: toolName,
          file,
          pattern: result.pattern,
          pattern_id: patternId,
          context: result.context,
          confidence,
          occurrence,
        };
        writeObservation(observation);
        break; // 每次工具调用最多记录一个模式
      }
    }

    // F12: 红旗检测（独立于模式检测，在 break 之后执行）
    detectRedFlags(history, current);

    // 追加历史（原子写入，避免竞争条件）
    appendHistoryEntry(current);
  } catch {
    // 观察失败不阻止正常工作流
  }

  process.exit(0);
}

main();

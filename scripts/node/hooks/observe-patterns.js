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
} = require("../lib/utils");

// --help 支持
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

// 配置
const MAX_HISTORY = parseInt(process.env.MAX_HISTORY || "10", 10);
const MAX_OBSERVATIONS = parseInt(process.env.MAX_OBSERVATIONS || "200", 10);

/**
 * 获取历史记录文件路径（按会话隔离）
 */
function getHistoryPath() {
  const sessionId = getSessionIdShort("default");
  return path.join(getTempDir(), `claude-observe-${sessionId}.json`);
}

/**
 * 读取工具调用历史
 */
function readHistory() {
  const historyPath = getHistoryPath();
  if (!fileExists(historyPath)) return [];
  try {
    return JSON.parse(readFile(historyPath) || "[]");
  } catch {
    return [];
  }
}

/**
 * 写入工具调用历史（保留最近 MAX_HISTORY 条）
 */
function writeHistory(history) {
  const trimmed = history.slice(-MAX_HISTORY);
  writeFile(getHistoryPath(), JSON.stringify(trimmed));
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
        const observation = {
          sessionId: getSessionIdShort("unknown"),
          timestamp: getDateTimeString(),
          tool: toolName,
          file: current.file ? path.basename(current.file) : "",
          pattern: result.pattern,
          context: result.context,
          confidence: result.confidence,
        };
        writeObservation(observation);
        break; // 每次工具调用最多记录一个模式
      }
    }

    // 更新历史
    history.push(current);
    writeHistory(history);
  } catch {
    // 观察失败不阻止正常工作流
  }

  process.exit(0);
}

main();

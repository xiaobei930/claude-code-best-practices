#!/usr/bin/env node
/**
 * Post Tool Use Failure: 工具调用失败后的错误学习
 *
 * 当工具调用失败时追踪错误模式：
 * 1. 记录失败的工具和错误信息
 * 2. 检测重复失败模式（红旗 #4 增强）
 * 3. 连续 3 次同类失败输出警告
 * 跨平台支持（Windows/macOS/Linux）
 *
 * 触发时机: PostToolUseFailure
 * 匹配工具: *
 *
 * Exit codes:
 * - 0: 正常完成
 */

// --help 支持
if (process.argv.includes("--help")) {
  console.log(`post-tool-failure.js - 工具失败追踪

用途: PostToolUseFailure hook，追踪工具失败模式并检测重复错误
触发: 工具调用失败后`);
  process.exit(0);
}

const path = require("path");
const {
  readStdinJson,
  getMemoryBankDir,
  readJsonFile,
  writeJsonFile,
  ensureDir,
  log,
  shouldRunInProfile,
} = require("../lib/utils");

// Hook Profile 检查
if (!shouldRunInProfile("post-tool-failure")) {
  process.exit(0);
}

/**
 * 加载失败记录
 */
function loadFailureLog(memoryBank) {
  const logPath = path.join(memoryBank, ".tool-failures.json");
  return readJsonFile(logPath) || { failures: [], sessionCount: 0 };
}

/**
 * 保存失败记录
 */
function saveFailureLog(memoryBank, data) {
  ensureDir(memoryBank);
  const logPath = path.join(memoryBank, ".tool-failures.json");
  writeJsonFile(logPath, data);
}

async function main() {
  try {
    const input = await readStdinJson();

    const toolName = input.tool_name || "unknown";
    const errorMessage =
      (input.tool_result && input.tool_result.stderr) ||
      (input.tool_result && input.tool_result.error) ||
      "unknown error";

    // 记录失败
    const memoryBank = getMemoryBankDir();
    const failureLog = loadFailureLog(memoryBank);

    const failure = {
      tool: toolName,
      error: String(errorMessage).slice(0, 200),
      timestamp: Date.now(),
    };

    failureLog.failures.push(failure);
    failureLog.sessionCount = (failureLog.sessionCount || 0) + 1;

    // 只保留最近 50 条记录
    if (failureLog.failures.length > 50) {
      failureLog.failures = failureLog.failures.slice(-50);
    }

    saveFailureLog(memoryBank, failureLog);

    // 检测重复失败模式（最近 10 次中同工具失败 3+ 次）
    const recentFailures = failureLog.failures.slice(-10);
    const toolFailureCount = recentFailures.filter(
      (f) => f.tool === toolName,
    ).length;

    if (toolFailureCount >= 3) {
      log(
        `[RedFlag] ⚠️ 工具 "${toolName}" 最近 10 次操作中失败 ${toolFailureCount} 次`,
      );
      log(`[RedFlag] 建议: 检查根本原因，考虑换用其他方法`);
    }

    // 检测连续相同错误
    const last3 = failureLog.failures.slice(-3);
    if (
      last3.length === 3 &&
      last3.every((f) => f.tool === toolName) &&
      last3.every((f) => f.error === last3[0].error)
    ) {
      log(
        `[RedFlag] ⚠️ 连续 3 次相同失败: ${toolName} - ${last3[0].error.slice(0, 80)}`,
      );
      log(`[RedFlag] 建议: 停止重试，分析错误原因后再继续`);
    }

    process.exit(0);
  } catch {
    // 静默失败，不影响主流程
    process.exit(0);
  }
}

main();
